const QueryBuilder = require('../model/query-builder.js');

const express = require('express'),
    fs = require('fs'),
    db = require('../service/database'),
    router = express.Router();

router.get('/export/:type', async function (req, res) {
    const subs = await db.findAll(
        QueryBuilder.exec(`SELECT sub.channelId, sub.channelTitle, ('https://www.youtube.com/channel/' || sub.channelId) channelUrl, group_concat(bookmarked.videoId) as bookmarkedVideos
                                 FROM Subscription sub
                                 LEFT OUTER JOIN(
                                     SELECT ('https://www.youtube.com/watch?v=' || videoId) videoId, channelId
                                     FROM Video JOIN Bookmark USING(videoId)) bookmarked USING (channelId)
                                 GROUP BY sub.channelId
                                 ORDER BY LOWER(sub.channelTitle) ASC`)
    );

    const collections = await db.findAll(QueryBuilder.exec(`
    SELECT c.name, GROUP_CONCAT(('https://www.youtube.com/watch?v=' || ca.videoId)) as videos
    FROM Collection c
    LEFT OUTER JOIN CollectionAssociation ca USING(id)
    GROUP BY name
    ORDER BY id asc
    `))

    const profile = {
        version: '1.0',
        subscriptions: subs.map(sub => {
            sub.bookmarkedVideos = sub.bookmarkedVideos ? sub.bookmarkedVideos.split(",") : []
            return sub;
        }),
        collections: collections.map(collection => {
            collection.videos = collection.videos ? collection.videos.split(",") : []
            return collection;
        })
    }
    fs.writeFileSync(`./www/profile/export.json`, JSON.stringify(profile));
    res.download('./www/profile/export.json', 'profile.json');
})

module.exports = router;