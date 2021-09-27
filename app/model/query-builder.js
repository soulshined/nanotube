function mapToPlaceholders() {
    return '?';
}

class QueryBuilder {

    static insert(table) {
        return new InsertQueryBuilder(table);
    }

    static select(table, ...cols) {
        return new SelectQueryBuilder(table, ...cols);
    }

    static update(table) {
        return new UpdateQueryBuilder(table);
    }

    static delete(table) {
        return new DeleteQueryBuilder(table);
    }

    static where(lhs, operation, rhs) {
        return new WhereBuilder(lhs, operation, rhs);
    }

    static exec(query) {
        return {
            build: () => {
                // console.log(query);
                return [query, []];
            }
        }
    }

}

class DeleteQueryBuilder {

    constructor(table) {
        this.table = table;
        this.params = [];
    }

    where(whereBuilder) {
        this.whereExpression = whereBuilder;
        return this;
    }

    build() {
        const sql = [
            `DELETE FROM ${this.table}`,
        ]
        if (this.whereExpression) {
            const [expr, values] = this.whereExpression.build();
            sql.push(expr);
            this.params.push(...values);
        }

        // console.log(sql.join(" "), this.params.flat(1));
        return [sql.join(" "), this.params.flat(1)];
    }

}

class UpdateQueryBuilder {

    constructor(table) {
        this.table = table;
        this.expressions = [];
        this.params = [];
    }

    set(field, value) {
        this.expressions.push([field, '=', '?']);
        this.params.push(value);
        return this;
    }

    where(whereBuilder) {
        this.whereExpression = whereBuilder;
        return this;
    }

    build() {
        const sql = [
            `UPDATE ${this.table} SET`,
            ...this.expressions.map(expr => expr.join(", "))
        ]
        if (this.whereExpression) {
            const [expr, values] = this.whereExpression.build();
            sql.push(expr);
            this.params.push(...values);
        }

        // console.log(sql.join(" "), this.params.flat(1));
        return [sql.join(" "), this.params.flat(1)];
    }

}

class InsertQueryBuilder {

    constructor(table) {
        this.columns = [];
        this.rows = [];
        this.table = table;
        this.additionalExpressions = [];
    }

    column(...columns) {
        columns.forEach(col => {
            if (!this.columns.includes(col)) this.columns.push(col)
        });
        return this;
    }

    row(...values) {
        this.rows.push([...values]);
        return this;
    }

    append(string) {
        this.additionalExpressions.push(string);
        return this;
    }

    build() {
        let sql = `INSERT INTO ${this.table}`;
        if (this.columns.length > 0)
            sql += `(${ this.columns.join(', ') })`;
        sql += ` VALUES`;

        if (this.rows.length === 0) return;

        sql += this.rows.map(row => `(${row.map(() => '?').join(", ")})`).join(", ");

        if (this.additionalExpressions.length > 0)
            sql += ` ${this.additionalExpressions.join(" ")}`;

        return [sql, this.rows.flat(1)];
    }

}

class SelectQueryBuilder {

    constructor(table, ...cols) {
        this.table = table;
        this.columns = (cols || []).length === 0 ? ['*'] : cols;
        this.orderColumn = undefined;
        this.orderDirection = 'asc';
        this.joins = [];
        this.params = [];
        this.whereExpression = null;
    }

    limit(count, offset = 0) {
        this.count = count;
        this.limitOffset = offset;
        return this;
    }

    order(column, direction) {
        this.orderColumn = column;
        this.orderDirection = 'asc';
        // if (direction)
            // this.orderDirection = ['asc', 'desc'].includes(direction.toLowerCase()) ? direction.toLowerCase() : 'asc';
        return this;
    }

    where(whereBuilder) {
        this.whereExpression = whereBuilder;
        return this;
    }

    join(table, using) {
        this.joins.push(['JOIN', table, 'USING', `(${using})`]);
        return this;
    }

    build() {
        const sql = [
            `SELECT ${this.columns.join(", ")}`,
            `FROM ${this.table}`,
            this.joins.map(m => m.join(" ")).join(" ")
        ]

        if (this.whereExpression) {
            const [expr, values] = this.whereExpression.build();
            sql.push(expr);
            this.params.push(...values);
        }

        if (this.orderColumn)
            sql.push(`ORDER BY ${this.orderColumn} asc`);

        if (this.count) {
            sql.push(`LIMIT ${this.count}`);
            sql.push(`OFFSET ${this.limitOffset}`);
        }

        // console.log(sql.join(" "), this.params.flat(1));
        return [sql.join(" "), this.params.flat(1)];
    }

}

class WhereBuilder {

    constructor(lhs, operation, rhs) {
        if (operation.toLowerCase() === 'in') {
            this.expressions = [[lhs, 'in', `(${rhs.map(mapToPlaceholders)})`]];
            this.params = [rhs];
        }
        else {
            this.expressions = [[lhs, operation, `?`]];
            this.params = [rhs];
        }

    }

    group(whereBuilder) {
        this.expressions.push(['(', ...whereBuilder.expressions.flat(1), ')']);
        this.params.push(...whereBuilder.params);
        return this;
    }

    and() {
        this.expressions.push(['AND']);
        return this;
    }

    or() {
        this.expressions.push('OR');
        return this;
    }

    equals(lhs, rhs) {
        this.expressions.push([lhs, '=', `?`]);
        this.params.push(rhs);
        return this;
    }

    build() {
        const sql = [
            'WHERE',
            ...this.expressions.map(expr => expr.join(" "))
        ]

        return [sql.join(" "), this.params];
    }
}

module.exports = QueryBuilder;