const { Entry } = require('../model/feed/feed.js');

const express = require('express'),
    QueryBuilder = require('../model/query-builder.js'),
    { TABLES } = require('../model/enum.js'),
    db = require('../service/database'),
    router = express.Router();

router.get('/', function (req, res, next) {
    db.findAll(
        QueryBuilder.select(TABLES.VIDEO)
            .join(TABLES.BOOKMARK, 'videoId')
    )
        .then(bookmarks => res.status(200).json(bookmarks.map(bm => {
            const entry = Entry.fromBookmark(bm);
            entry.isBookmarked = true;
            return entry;
        })))
        .catch((err) => next(err));
})

router.post('/:videoId', function (req, res) {
    const { channelId, title, publishedDate, author, description } = req.query;

    const conn = db.instance(false);
    conn.serialize(() => {
        conn.run(...QueryBuilder.insert(TABLES.VIDEO)
            .row(req.params.videoId, channelId, author, title, new Date(publishedDate).getTime(), description).build(), () => {
                return;
            }
        )
            .run(...QueryBuilder.insert(TABLES.BOOKMARK).row(req.params.videoId).build(),
                (err) => {
                    conn.close();
                    if (err) return next(err);
                    else return res.sendStatus(201);
                }
            )
    })
})

router.delete('/:videoId', function (req, res, next) {
    db.runOnce(QueryBuilder.delete(TABLES.BOOKMARK).where(
        QueryBuilder.where('videoId', '=', req.params.videoId)
    ))
        .then(() => res.sendStatus(204))
        .catch((err) => next(err))
})

module.exports = router;