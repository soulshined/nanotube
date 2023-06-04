const { parseStringPromise } = require('xml2js'),
    DateUtils = require('../utils/date');
const Pageable = require('../model/feed/page');
const { Feed } = require('../model/feed/feed');

const express = require('express'),
    { Utils } = require('../utils/utils.js'),
    router = express.Router(),
    QueryBuilder = require('../model/query-builder'),
    db = require('../service/database'),
    { TABLES } = require('../model/enum'),
    { isCachedExpired } = require('../middleware/cache-manager');

//get all subscriptions with bookmarks
router.get('/', async (req, res) => {
    const rows = await db.findAll(QueryBuilder.select(TABLES.SUBSCRIPTION).order('lower(channelTitle)'));
    res.status(200).json(rows);
})

router.get('/:channelId', async (req, res) => {

    const channel = await db.getOne(QueryBuilder.select(TABLES.SUBSCRIPTION).where(
        QueryBuilder.where('channelId', '=', req.params.channelId)
    ))

    if (!channel) {
        res.statusMessage = 'Subscription not found';
        res.sendStatus(400);
    }

    return res.status(200).json(channel);
})
router.get('/today/:isFavoritesOnly', async (req, res) => {
    let { cursor, limit, dayRange } = req.query;

    limit = limit || 15;
    cursor = cursor.split(',', 2).map(m => +m);
    dayRange = dayRange ? Utils.clamp(+dayRange, 2, 30) : 2;

    if (!dayRange || dayRange < 2) {
        res.statusMessage = "Invalid date range";
        res.sendStatus(400);
        return;
    }

    try {
        const subs = await db.findAll(QueryBuilder.exec(`SELECT sub.*, f.feed, f.createdAt feedCreatedAt, group_concat(watched.videoId) as watchedVideos
                                 FROM Subscription sub
								 LEFT OUTER JOIN(SELECT videoId, channelId FROM Video JOIN Watched USING(videoId)
WHERE createdAt >= datetime('now', '-${dayRange} day', 'localtime')) watched USING(channelId)
                                 LEFT OUTER JOIN Feed f USING(channelId)
                                 ${req.params.isFavoritesOnly === 'true' ? `WHERE isFavorite = 1` : ''}
								 GROUP BY sub.channelId`));

        const bookmarks = await db.findAll(QueryBuilder.select(TABLES.BOOKMARK)).then(rows => {
            if (!rows) return [];
            return rows.map(row => row.videoId)
        });

        const results = [];
        const conn = db.instance(false);
        conn.serialize(async () => {
            let youtube404s = 0;

            for (let i = cursor[0]; i < subs.length; ++i) {
                const sub = subs[i];
                cursor[1] = cursor[0] === i ? cursor[1] : 0;
                const watchedChannelVideos = sub.watchedVideos ? sub.watchedVideos.split(",") : [];

                if (sub.feed && !isCachedExpired(sub.feedCreatedAt)) {
                    if (res.headersSent) continue;

                    //check if cached feed is expired
                    const feed = JSON.parse(sub.feed.toString('utf-8'));

                    //get videoIds
                    for (let j = cursor[1]; j < feed.entries.length; ++j) {
                        const entry = feed.entries[j];
                        if (!DateUtils.isDateWithinLastNumOfDays(new Date(entry.publishedDate), dayRange)) continue;

                        if (watchedChannelVideos.includes(entry.videoId)) continue;

                        entry.isBookmarked = bookmarks.includes(entry.videoId);
                        results.push(entry);
                        if (results.length >= limit) {
                            return res.status(200).json(
                                new Pageable(results, [i, j + 1], i >= subs.length && j >= feed.entries.length)
                            );
                        }
                    }

                }
                else {
                    //no cached feed
                    try {
                        const response = await Utils.doChannelRequest('channel_id', sub.channelId);
                        const xml = await parseStringPromise(response);
                        const feed = new Feed(xml.feed);
                        youtube404s = 0;

                        conn.run(...QueryBuilder.insert(TABLES.FEED)
                            .row(sub.channelId, Buffer.from(JSON.stringify(feed), 'utf-8'), new Date().getTime())
                            .append(`ON CONFLICT(channelId) DO UPDATE SET createdAt=excluded.createdAt, feed=excluded.feed`).build(), (err) => {

                                if (err) console.log('Error updaing feed for ' + sub.channelTitle + ' ' + err);
                                else if (!res.headersSent) {
                                    for (let j = cursor[1]; j < feed.entries.length; ++j) {
                                        const entry = feed.entries[j];
                                        if (!DateUtils.isDateWithinLastNumOfDays(new Date(entry.publishedDate), dayRange)) continue;

                                        if (watchedChannelVideos.includes(entry.videoId)) continue;

                                        entry.isBookmarked = bookmarks.includes(entry.videoId);
                                        results.push(entry);
                                        if (results.length >= limit) {
                                            return res.status(200).json(
                                                new Pageable(results, [i, j + 1], i >= subs.length && j >= feed.entries.length)
                                            );
                                        }
                                    }
                                }
                        })
                    } catch (error) {
                        youtube404s += +(error === 404);
                        if (youtube404s >= 9) {
                            console.log('Too many YouTube XML Feed 404s');
                            if (!res.headersSent)
                                res.sendStatus(404);
                            else break;
                        }
                    }
                }
            }

            conn.close(() => {
                if (!res.headersSent)
                    res.status(200).json(new Pageable(results, [subs.length, 0], true));
            });
        })

    }
    catch (err) {
        console.log(err);
        if (!res.headersSent)
            res.status(500).send('Error retrieving subscriptions from database');
    }

})

router.post('/:type/:channelId', async function (req, res, next) {
    const response = await Utils.doChannelRequest(req.params.type, req.params.channelId);
    const xml = await parseStringPromise(response);
    const feed = new Feed(xml.feed);
    const { channelId, channelTitle, channelPublishDate } = feed;

    db.insertFeed(channelId, feed)
        .then(() => {
            db.runOnce(QueryBuilder.insert(TABLES.SUBSCRIPTION)
                .column('channelId', 'channelTitle', 'channelPublishedDate')
                .row(channelId, channelTitle, channelPublishDate)
            ).then(() => res.status(201).json({ channelId, channelTitle }))
                .catch((err) => {
                    if (err.toString().includes('UNIQUE constraint failed: Subscription.channelId')) {
                        res.status(422).send('Subscription already exists');
                    }
                    next(err)
                });

        })
        .catch((err) => next(err));
})

router.delete('/:id', function (req, res, next) {
    db.runOnce(QueryBuilder.delete(TABLES.SUBSCRIPTION).where(
        QueryBuilder.where('channelId', '=', req.params.id)
    ))
        .then(() => res.sendStatus(204))
        .catch((err) => next(err))
})

router.put('/favorite/:id/:isFavorite', function (req, res, next) {
    db.runOnce(
        QueryBuilder.update(TABLES.SUBSCRIPTION)
            .set('isFavorite', +req.params.isFavorite)
            .where(
                QueryBuilder.where('channelId', '=', req.params.id)
            )
    ).then(() => {
        return res.sendStatus(200);
    })
        .catch(err => {
            res.statusMessage = err;
            res.sendStatus(500);
        })
})

module.exports = router;