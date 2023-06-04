const https = require('https');

class Utils {

    static clamp(val, min, max = Number.MAX_VALUE) {
        if (val < min) return min;
        if (val > max) return max;

        return val;
    }

    static doVideoRequest(videoId) {
        const url = new URL(videoId);
        videoId = url.searchParams.get('v');

        if (url.hostname === 'youtu.be')
            videoId = url.pathname.substring(1);

        if (videoId === null)
            return Promise.reject(new Error("YouTube video search error: video id can't be found"));

        return new Promise((resolve, reject) => {
            const req = https.request(`https://www.youtube.com/watch?v=${videoId}`, res => {
                let body = '';
                res.on('data', d => {
                    body += d;
                })

                res.on('end', () => {
                    if (!res || ![202, 200, 201].includes(res.statusCode)) {
                        console.log(`YouTube video ${videoId} non-ok response`, res.statusCode, res.statusMessage);
                        reject(res.statusCode);
                    }
                    else resolve(body);
                })

            })

            req.on('error', error => {
                console.log('YouTube Video Search Error:', error);
                reject(500);
            })

            req.end();
        });
    }

    static doChannelRequest(channelType, channelId) {
        const isHandle = channelType === 'handle';

        return new Promise((resolve, reject) => {
            const uri = `https://www.youtube.com/` + (isHandle ? channelId : `feeds/videos.xml?${channelType}=${channelId}`);
            const req = https.request(uri, res => {
                let body = '';
                res.on('data', d => {
                    body += d;
                })

                res.on('end', () => {
                    if (!res || ![202, 200, 201].includes(res.statusCode)) {
                        console.log('YouTube XML non-ok response', res.statusCode, res.statusMessage);
                        reject(res.statusCode);
                    }
                    else {
                        if (isHandle) {
                            resolve(this.doChannelRequest('channel_id', body.match(/"browseId"\s*:\s*"([^"]+)"/)[1]));
                        } else resolve(body);
                    }
                })

            })

            req.on('error', error => {
                console.log('YouTube XML Error:', error);
                reject(500);
            })

            req.end();
        });
    }

}

module.exports = {
    Utils,
    FILEPATHS : {
        zip: './www/profile/export.zip',
        playlists: './www/profile/playlists.json',
        database: './app/nanotube.db'
    }
}