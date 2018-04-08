const { Pool } = require('pg');
// const QueryStream = require('pg-query-stream') // couldn't get this to work :(
const format = require('pg-format');
const debug = require('debug')('db');

const config = require('./config');

class Queryable {
  constructor(queryable) {
    this._target = queryable; // the wrapped queryable
    this.query = queryable.query.bind(queryable);
  }

  /**
   * @desc get the names of all the tables in the database
   */
  async getTableNames() {
    const result = await this.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema='public'
      AND table_type='BASE TABLE';
    `);
    return result.rows.map(row => {
      return row.table_name;
    });
  }
  
  /** 
   * @name clearDatabase
   * @desc iterates all tables in the database and removes each one
  */
  async clearDatabase() {
    const tablenames = await this.getTableNames();
    for (let i = 0; i < tablenames.length; ++i) {
      const tablename = tablenames[i];
      debug("dropping table " + tablename);
      await this.query(format("DROP TABLE %I", tablename));
    }
    debug("done clearing database.");
  }
}

class Transaction extends Queryable {
  constructor(target) {
    super(target);
  }

  async abort() {
    await this._target.query("ROLLBACK");
    this._target.release();
  }

  async commit() {
    await this._target.query("COMMIT");
    this._target.release();
  }
}

class Database extends Queryable {
  constructor(connectionString) {
    super(new Pool({
      connectionString: connectionString
    }));
    this._connectionString = connectionString;
  }

  /**
   * @desc returns a transaction that takes the callback
   * @param {*} callback
   */
  async transactionWith(callback) {
    // get a connection from the connection pool
    const target = await this._target.connect(); 

    const transaction = new Transaction(target);
    try {
      debug("beginning transaction");
      const returnValue = await callback(transaction);
      await transaction.commit();
      debug("committed transaction");
      return returnValue;
    } catch (e) {
      debug("aborted transaction");
      await transaction.abort();
      throw e;
    }
  }

  async end() {
    debug("closing down connection pool");
    await this._target.end();
    debug("closed connection pool");
  }
}

module.exports = {
  Queryable,
  Transaction,
  Database,
  format, // just as a utility
  db: new Database(config["PostgreSQL"])
}
