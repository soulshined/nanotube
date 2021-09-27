const { TABLES } = require('../model/enum.js');
const { Entry } = require('../model/feed/feed.js');
const QueryBuilder = require('../model/query-builder.js');

const express = require('express'),
    db = require('../service/database'),
    router = express.Router();

router.get('/', function (req, res, next) {
    let { sortDir } = req.query;
    sortDir = sortDir && ['desc', 'asc'].includes(sortDir) ? sortDir : 'asc';

    db.findAll(QueryBuilder.exec(`
            SELECT c.id, c.name, ca.videoId, temp.total FROM Collection c
	        LEFT OUTER JOIN (SELECT id, COUNT(*) as total FROM CollectionAssociation ca JOIN Collection USING (id) GROUP BY id) temp USING (id)
            LEFT OUTER JOIN CollectionAssociation ca USING(id)
            WHERE videoId in (SELECT videoId FROM CollectionAssociation WHERE id = ca.id LIMIT 6)
            OR videoId IS NULL`))
        .then(associations => {
            let reduced = Object.values(associations.reduce((prev, curr) => {
                const prop = curr['id'];
                prev[prop] = prev[prop] || { id: curr['id'], name: curr['name'], totalVideos: curr['total'] || 0, videos: [] };
                if (curr.videoId)
                    prev[prop].videos.push(curr.videoId);
                return prev;
            }, {}));
            if (sortDir) {
                if (sortDir === 'desc') {
                    reduced = reduced.sort((a, b) => {
                        a = a.name.toLowerCase();
                        b = b.name.toLowerCase();

                        if (b < a) return -1;
                        if (b > a) return 1;
                        return 0;
                    })
                }
                else reduced = reduced.sort((a, b) => {
                    a = a.name.toLowerCase();
                    b = b.name.toLowerCase();

                    if (a < b) return -1;
                    if (a > b) return 1;
                    return 0;
                })
            }
            return res.status(200).json(reduced);
        })
        .catch((err) => next(err));
})

router.get('/:collectionId', function (req, res) {
    db.findAll(QueryBuilder.exec(`SELECT ca.*, v.*,
                                  CASE
                                    WHEN bm.videoId IS NOT NULL THEN '1'
                                    ELSE NULL
                                  END as isBookmarked
                                  FROM CollectionAssociation ca
                                  JOIN Video v USING (videoId)
                                  LEFT OUTER JOIN Bookmark bm USING (videoId)
                                  WHERE ca.id = '${req.params.collectionId}'`))
        .then(collection => res.status(200).json(collection.map(p => {
            const entry = Entry.fromBookmark(p);
            entry.collectionId = p.id;
            return entry;
        })))
        .catch((err) => next(err));
})

router.post('/:collectionName', function (req, res, next) {
    db.runOnce(QueryBuilder.insert(TABLES.COLLECTION)
        .column('name')
        .row(req.params.collectionName)
    )
        .then(() => res.sendStatus(201))
        .catch((err) => next(err))
})

router.post('/:id/association', function (req, res, next) {
    const { videoId, channelId, title, publishedDate, author, description } = req.query;

    if (!videoId || !channelId || !title || !publishedDate || !author) {
        res.statusMessage = "Invalid form data";
        res.sendStatus(400);
        return;
    }

    if (isNaN(req.params.id)) {
        res.statusMessage = 'Invalid collection id';
        res.sendStatus(400);
        return;
    }

    const conn = db.instance(false);
    conn.serialize(() => {
        conn.run(...QueryBuilder.insert(TABLES.VIDEO)
            .row(videoId, channelId, author, title, new Date(publishedDate).getTime(), description).build(), () => {
                return;
            }
        )
            .run(...QueryBuilder.insert(TABLES.COLLECTION_ASSC)
                .row(req.params.id, videoId).build(),
                (err) => {
                    conn.close();
                    if (err) {
                        if (err.code === 'SQLITE_CONSTRAINT' && err.message.includes('UNIQUE constraint failed: CollectionAssociation.id, CollectionAssociation.videoId')) {
                            res.statusMessage = 'Item already exists in collection';
                            res.sendStatus(400);
                        }
                        else next(err);
                    }
                    else return res.sendStatus(201);
                }
            )
    })

})

router.delete(`/:id`, function (req, res, next) {
    db.runOnce(QueryBuilder.delete(TABLES.COLLECTION)
        .where(
            QueryBuilder.where('id', '=', req.params.id)
        )
    )
        .then(() => res.sendStatus(204))
        .catch(err => next(err));
})

router.delete(`/:id/association/:videoId`, function (req, res, next) {
    if (!req.params.id || !req.params.videoId) return res.sendStatus(400);

    db.runOnce(QueryBuilder.delete(TABLES.COLLECTION_ASSC)
        .where(
            QueryBuilder.where('id', '=', req.params.id)
                .and()
                .equals('videoId', req.params.videoId)
        )
    )
        .then(() => res.sendStatus(204))
        .catch(err => next(err));
})

module.exports = router;