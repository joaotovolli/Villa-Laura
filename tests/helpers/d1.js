import initSqlJs from "sql.js";

class Statement {
  constructor(database, sql, params = []) {
    this.database = database;
    this.sql = sql;
    this.params = params;
  }

  bind(...params) { return new Statement(this.database, this.sql, params); }

  execute() {
    const statement = this.database.prepare(this.sql);
    try {
      statement.bind(this.params);
      const results = [];
      while (statement.step()) results.push(statement.getAsObject());
      return { results, meta: { changes: this.database.getRowsModified() } };
    } finally {
      statement.free();
    }
  }

  async all() { return this.execute(); }
  async first() { return this.execute().results[0] || null; }
  async run() { return this.execute(); }
}

export const makeD1 = async (migrationSql) => {
  const SQL = await initSqlJs();
  const database = new SQL.Database();
  database.run(migrationSql);
  return {
    database,
    prepare(sql) { return new Statement(database, sql); },
    async batch(statements) {
      database.run("BEGIN");
      try {
        const results = statements.map((statement) => statement.execute());
        database.run("COMMIT");
        return results;
      } catch (error) {
        database.run("ROLLBACK");
        throw error;
      }
    }
  };
};

