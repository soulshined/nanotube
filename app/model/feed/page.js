class Pageable {

    constructor(results, cursor = [0, 0], isComplete = false) {
        this.cursor = cursor || [0, 0];
        this.results = results || [];
        this.isComplete = isComplete || false;
    }

}

module.exports = Pageable;