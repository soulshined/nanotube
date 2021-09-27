const { Utils } = require('../utils/utils.js');

const express = require('express'),
    router = express.Router();

router.get('/video/:videoId', async function (req, res, next) {
    Utils.doVideoRequest(req.params.videoId)
        .then(response => res.status(200).send(response))
        .catch(err => next(err));
})

module.exports = router;