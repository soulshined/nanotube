class Entry {
    constructor(entry) {
        this.entry = entry;
        this.title = entry.title[0];
        this.videoId = entry['yt:videoId'][0];
        this.channelId = entry['yt:channelId'][0];
        this.publishedDate = new Date(entry.published[0]);
        this.updatedDate = new Date(entry.updated[0]);
        this.thumbnail = `https://i4.ytimg.com/vi/${this.videoId}/maxresdefault.jpg`;
        this.author = entry.author[0].name[0];
        this.isBookmarked = false;

        const media = entry['media:group'][0];

        this.description = media['media:description'][0];
        this.views = media['media:community'][0]['media:statistics'][0]["$"].views;
    }

    static fromBookmark(bookmark) {
        return {
            title: bookmark.title,
            videoId: bookmark.videoId,
            channelId: bookmark.channelId,
            publishedDate: bookmark.publishedDate,
            description: bookmark.description,
            isBookmarked : bookmark.isBookmarked,
            thumbnail: `https://i4.ytimg.com/vi/${bookmark.videoId}/maxresdefault.jpg`,
            author: bookmark.author
        }
    }
}

class Feed {

    constructor(feed) {
        this.feed = feed;
        this.channelId = feed.author[0].uri[0].substring(feed.author[0].uri[0].lastIndexOf('/channel/') + '/channel/'.length);
        this.channelPublishDate = new Date(feed.published[0])
        this.channelTitle = feed.title[0];
        this.author = feed.author[0].name[0];

        this.entries = feed.entry.map(entry => new Entry(entry));
    }

}

module.exports = {
    Feed,
    Entry
};