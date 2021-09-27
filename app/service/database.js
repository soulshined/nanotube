const { FILEPATHS } = require('../utils/utils');

const sqlite3 = require('sqlite3').verbose(),
      QueryBuilder = require('../model/query-builder');

class DatabaseService {

    static init() {
        const db = new sqlite3.Database(FILEPATHS.database, (err) => {
            if (err) console.error(`Error connecting to db`, err.message);
            else console.log('Connected to the database\nValidating schema...');
        });

        db.serialize(async () => {
            db.run(`CREATE TABLE IF NOT EXISTS Subscription
                (
                    channelId VARCHAR(255) PRIMARY KEY NOT NULL,
                    channelTitle TEXT NOT NULL,
                    channelPublishedDate INTEGER NOT NULL,
                    isFavorite INTEGER NOT NULL DEFAULT 0
                )`)
                .run(`CREATE TABLE IF NOT EXISTS Video
                (
                    videoId VARCHAR(255) PRIMARY KEY NOT NULL,
                    channelId VARCHAR(255) NOT NULL,
                    author VARCHAR(255) NOT NULL,
                    title TEXT NOT NULL,
                    publishedDate INTEGER NOT NULL,
                    description TEXT NOT NULL
                )`)
                .run(`CREATE TABLE IF NOT EXISTS Bookmark
                (
                    videoId VARCHAR(255) PRIMARY KEY NOT NULL,

                    FOREIGN KEY (videoId)
                        REFERENCES Video(videoId)
                            ON DELETE CASCADE
                            ON UPDATE NO ACTION
                )`)
                .run(`CREATE TABLE IF NOT EXISTS Feed
                (
                    channelId VARCHAR(255) PRIMARY KEY NOT NULL,
                    feed BLOB NOT NULL,
                    createdAt INTEGER NOT NULL,

                    FOREIGN KEY (channelId)
                        REFERENCES Subscription(channelId)
                            ON DELETE CASCADE
                            ON UPDATE NO ACTION
                )`)
                .run(`CREATE TABLE IF NOT EXISTS Watched
                (
                    videoId VARCHAR(255) PRIMARY KEY NOT NULL,
                    createdAt DATE NOT NULL DEFAULT (datetime('now', 'localtime')),

                    FOREIGN KEY (videoId)
                        REFERENCES Video(videoId)
                            ON DELETE CASCADE
                            ON UPDATE NO ACTION
                )`)
                .run(`CREATE TABLE IF NOT EXISTS Collection
                (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(255)
                )`)
                .run(`CREATE TABLE IF NOT EXISTS CollectionAssociation
                (
                    id INTEGER NOT NULL,
                    videoId VARCHAR(255) NOT NULL,

                    FOREIGN KEY (id)
                        REFERENCES Collection(id)
                            ON DELETE CASCADE
                            ON UPDATE NO ACTION,

                    FOREIGN KEY (videoId)
                        REFERENCES Video(videoId)
                            ON DELETE CASCADE
                            ON UPDATE NO ACTION,

                    UNIQUE(id, videoId)
                )`)
                .run(`CREATE TABLE IF NOT EXISTS Settings
                (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    newVideoDateRange INTEGER DEFAULT 2,
                    autoTheatreMode INTEGER(1) DEFAULT 0,
                    youtubeIframeAPIEnabled INTEGER(1) DEFAULT 0,
                    youtubeIframeAPIAutoplay INTEGER(1) DEFAULT 0
                )
                `)
                .run(`INSERT OR IGNORE INTO Settings (id) VALUES (1)`)
                .close(() => {
                    console.log('Done validating schema');
                });
        })
    }

    static instance(readonly = true) {
        const opType = readonly ? sqlite3.OPEN_READONLY : sqlite3.OPEN_READWRITE;

        return new sqlite3.Database(FILEPATHS.database, opType, err => {
            if (err) throw err;
        })
    }

    static insertFeed(channelId, feed) {
        return new Promise((resolve, reject) => {
            const conn = DatabaseService.instance(false);

            conn.run(
                ...QueryBuilder.insert('Feed')
                    .row(channelId, Buffer.from(JSON.stringify(feed), 'utf-8'), new Date().getTime())
                    .append(`ON CONFLICT(channelId) DO UPDATE SET createdAt=excluded.createdAt, feed=excluded.feed`).build(),
                (err) => {
                    conn.close();
                    if (err) reject(err);
                    resolve();
                }
            )
        });
    }

    static runOnce(queryBuilder) {
        return new Promise((resolve, reject) => {
            const conn = DatabaseService.instance(false);
            conn.run(...queryBuilder.build(), (err, result) => {
                conn.close();
                if (err) reject(err);
                resolve(result);
            })
        });
    }

    static getOne(selectBuilder) {
        return new Promise((resolve, reject) => {
            const conn = DatabaseService.instance();

            conn.get(...selectBuilder.build(), (err, row) => {
                conn.close();
                if (err) {
                    console.log('DB Error', err);
                    reject(err);
                }

                resolve(row);
            });
        });
    }

    static findAll(selectBuilder) {
        const conn = DatabaseService.instance();

        return new Promise((resolve, reject) => {
            conn.all(...selectBuilder.build(),
                function (err, rows) {
                    conn.close((err) => {
                        if (err) reject(err);
                    });
                    if (err) reject(err);

                    resolve(rows);
                }
            );
        });

    }

}

module.exports = DatabaseService;