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
                        console.log('YouTube video non-ok response', res.statusCode, res.statusMessage);
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
        return new Promise((resolve, reject) => {
            const req = https.request(`https://www.youtube.com/feeds/videos.xml?${channelType}=${channelId}`, res => {
                let body = '';
                res.on('data', d => {
                    body += d;
                })

                res.on('end', () => {
                    if (!res || ![202, 200, 201].includes(res.statusCode)) {
                        console.log('YouTube XML non-ok response', res.statusCode, res.statusMessage);
                        reject(res.statusCode);
                    }
                    else resolve(body);
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