/// <reference types="node" />

// The MIT License (MIT)
// 
// vs-deploy (https://github.com/mkloubert/vs-deploy)
// Copyright (c) Marcel Joachim Kloubert <marcel.kloubert@gmx.net>
// 
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE.

import * as deploy_helpers from './helpers';
const MYSQL = require('mysql');


/**
 * MySQL connection options.
 */
export interface MySqlOptions {
    /**
     * The database to connect to.
     */
    database?: string;
    /**
     * The host.
     */
    host?: string;
    /**
     * The TCP port.
     */
    port?: number;
    /**
     * The password.
     */
    password?: string;
    /**
     * Reject untrusted SSL connections or not.
     */
    rejectUnauthorized?: boolean;
    /**
     * The username.
     */
    user?: string;
}

/**
 * A MySQL connection.
 */
export interface MySqlConnection extends SqlConnection {
    /** @inheritdoc */
    query: (sql: string, ...args: any[]) => Promise<MySqlResult>;
}

/**
 * A MySQL result.
 */
export interface MySqlResult extends SqlResult {
}

/**
 * A SQL connection.
 */
export interface SqlConnection {
    /**
     * The underlying connection object.
     */
    connection: any;
    /**
     * Closes the connection.
     * 
     * @returns {Promise<any>} The promise.
     */
    close: () => Promise<any>;
    /**
     * The (display) name of the connection.
     */
    name: string;
    /**
     * Invokes a query.
     * 
     * @param {string} sql The SQL query.
     * @param {any[]} [args] One or more argument for the query.
     * 
     * @returns {Promise<SqlResult>} The promise.
     */
    query: (sql: string, ...args: any[]) => Promise<SqlResult>;
    /**
     * The type (if known).
     */
    type?: SqlConnectionType;
}

/**
 * List of known SQL connection types.
 */
export enum SqlConnectionType {
    /**
     * MySQL
     */
    MySql = 0,
}

/**
 * A SQL result.
 */
export interface SqlResult {
}

/**
 * Creates a new MySQL connection.
 * 
 * @param {MySqlOptions} [opts] The options for the connection.
 * 
 * @returns {Promise<MySqlConnection>} The promise.
 */
export function createMySqlConnection(opts?: MySqlOptions): Promise<MySqlConnection> {
    if (!opts) {
        opts = {};
    }

    return new Promise<MySqlConnection>((resolve, reject) => {
        let completed = (err?: any, conn?: MySqlConnection) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(conn);
            }
        };
        
        try {
            let host = deploy_helpers.toStringSafe(opts.host).toLowerCase().trim();
            if (!host) {
                host = '127.0.0.1';
            }

            let port = deploy_helpers.toStringSafe(opts.port).trim();
            if (!port) {
                port = '3306';
            }

            let user = deploy_helpers.toStringSafe(opts.user).trim();
            if (!user) {
                user = 'root';
            }

            let pwd = deploy_helpers.toStringSafe(opts.password);
            if (!pwd) {
                pwd = undefined;
            }

            let db = deploy_helpers.toStringSafe(opts.database).trim();
            if (!db) {
                db = undefined;
            }

            let connOpts = {
                database: db,
                host: host,
                port: parseInt(port),
                user: user,
                password: pwd,
            };

            if (!deploy_helpers.isNullOrUndefined(opts.rejectUnauthorized)) {
                connOpts['ssl'] = {
                    rejectUnauthorized: deploy_helpers.toBooleanSafe(opts.rejectUnauthorized),
                };
            }

            let connection = MYSQL.createConnection(connOpts);

            connection.connect(function(err) {
                if (err) {
                    completed(err);
                    return;
                }

                let conn: MySqlConnection = {
                    close: () => {
                        return new Promise<any>((resolve2, reject2) => {
                            try {
                                connection.end((err) => {
                                    if (err) {
                                        reject2(err);
                                    }
                                    else {
                                        resolve2();
                                    }
                                });
                            }
                            catch (e) {
                                reject2(e);
                            }
                        });
                    },
                    connection: connection,
                    name: `mysql://${host}:${port}/${deploy_helpers.toStringSafe(db)}`,
                    query: (sql, args) => {
                        return new Promise<MySqlResult>((resolve2, reject2) => {
                            try {
                                connection.query({
                                    sql: sql,
                                    values: args,
                                }, (err, rows) => {
                                    if (err) {
                                        reject2(err);
                                    }
                                    else {
                                        let result: MySqlResult = {
                                        };

                                        resolve2(result);
                                    }
                                });
                            }
                            catch (e) {
                                reject2(e);
                            }
                        });
                    },
                    type: SqlConnectionType.MySql,
                };

                completed(null, conn);
            });
        }
        catch (e) {
            completed(e);
        }
    });
}

/**
 * Creates a new SQL connection.
 * 
 * @param {SqlConnectionType} [type] The type of the connection.
 * @param {any[]} [args] One or more arguments for the connection.
 * 
 * @returns {Promise<SqlConnection>} The promise.
 */
export function createSqlConnection(type: SqlConnectionType, args?: any[]): Promise<SqlConnection> {
    let me = this;

    if (!args) {
        args = [];
    }

    return new Promise<SqlConnection>((resolve, reject) => {
        let func: Function;
        switch (type) {
            case SqlConnectionType.MySql:
                func = createMySqlConnection;
                break;
        }

        if (func) {
            try {
                func.apply(me, args).then((conn) => {
                    resolve(conn);
                }).catch((err) => {
                    reject(err);
                });
            }
            catch (e) {
                reject(e);
            }
        }
        else {
            reject(new Error(`Type '${type}' is not supported!`));
        }
    });
}
