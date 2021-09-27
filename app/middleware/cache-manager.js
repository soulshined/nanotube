const { TABLES } = require("../model/enum");
const QueryBuilder = require("../model/query-builder");
const db = require("../service/database");
const clearCacheInterval = 90;

async function handleCachedFeed(req, res, next) {
    if (!req.params.channelId) return next();

    const row = await db.getOne(QueryBuilder.select(TABLES.FEED)
        .where(QueryBuilder.where('channelId', '=', req.params.channelId))
    );

    if (!row) return next();

    if (!isExpired(row.createdAt)) {
        const feed = JSON.parse(row.feed.toString('utf-8'));
        const entryVideoIds = feed.entries.map((m, i) => [i, m.videoId]);
        db.findAll(QueryBuilder.select(TABLES.BOOKMARK, 'videoId').where(QueryBuilder.where('videoId', 'in', entryVideoIds.map(m => m[1]))))
            .then(bookmarks => {
                bookmarks.forEach(({ videoId }) => {
                    feed.entries[entryVideoIds.find(e => e[1] === videoId)[0]].isBookmarked = true;
                })
                return res.status(200).json(feed);
            })
            .catch((err) => next(err))
    }
    else next();
}

function isExpired(feedCreatedAt) {
    return (((new Date().getTime() - new Date(feedCreatedAt).getTime()) / 1000) / 60) >= clearCacheInterval
}

module.exports = {
    handleCachedFeed,
    isCachedExpired: isExpired
};