const express = require('express'),
    router = express.Router(),
    QueryBuilder = require('../model/query-builder.js'),
    { TABLES } = require('../model/enum.js'),
    db = require('../service/database');

router.post('/:videoId/watched', function (req, res, next) {
    const { channelId, title, author, publishedDate, description } = req.query;

    const conn = db.instance(false);
    conn.serialize(() => {

        conn.run(...QueryBuilder.insert(TABLES.VIDEO)
            .row(req.params.videoId, channelId, author, title, new Date(publishedDate).getTime(), description).build(),
            () => {}
        )
            .run(...QueryBuilder.insert(TABLES.WATCHED).column('videoId').row(req.params.videoId)
                .append(`ON CONFLICT(videoId) DO UPDATE SET createdAt=excluded.createdAt`).build(), (err) => {
                conn.close();
                if (err) return next(err);

                return res.sendStatus(201);
            })
    })
})

module.exports = router;