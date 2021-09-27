const { TABLES } = require('../model/enum.js');
const QueryBuilder = require('../model/query-builder.js');

const express = require('express'),
    router = express.Router(),
    db = require('../service/database');

router.get('/', async function (req, res) {
    const row = await db.getOne(QueryBuilder.select(TABLES.SETTINGS));
    res.status(200).json(row);
})

router.put('/', express.json(), async function (req, res) {
    db.runOnce(
        QueryBuilder.exec(`UPDATE Settings SET newVideoDateRange=${req.body.newVideoDateRange},
            youtubeIframeAPIAutoplay=${+req.body.youtubeIframeAPIAutoplay},
            youtubeIframeAPIEnabled=${+req.body.youtubeIframeAPIEnabled},
            autoTheatreMode=${+req.body.autoTheatreMode}

            WHERE id=1`)
    ).then(() => {
        return res.sendStatus(201);
    })
    .catch(err => {
        res.statusMessage = err;
        res.sendStatus(500);
    })
})

module.exports = router;