import fs from 'fs'; // fs의 baseUrl은 프로젝트 메인이다.

const { Client } = require('pg');

let baseUrl = '/sqls';
function procQuery(sql) {
  const client = new Client({
    user: process.env.db_user,
    host: process.env.db_host,
    database: process.env.db_name,
    password: process.env.db_password,
    port: process.env.db_port,
  });
  client.connect();
  const promise = new Promise((resolve, reject) => {
    client.query(sql, (err, res) => {
      if (err) {
        reject(err);
      } else {
        console.log(res, '\n\n\n\n');
        resolve({
          type: 'success',
          message: res,
        });
      }
      client.end();
    });
  });
  return promise;
}
export default function setBaseURL(url) {
  baseUrl = url;
}
/* eslint no-extend-native: ["error", { "exceptions": ["String"] }] */
String.prototype.strQuery = async function strQuery() {
  let result;
  const sql = this;
  try {
    result = await procQuery(sql);
  } catch (err) {
    console.log(err, '\n\n\n\n');
    result = {
      type: 'error',
      onError: (res, id, name, code) => {
        const prm = {
          type: 'error',
          resultCode: code || 400,
          id: ['ERR', baseUrl, id].join('.'),
          name: [name, 'query failed'].join(' '),
        };
        res.end(JSON.stringify(prm));
        return 'error';
      },
    };
  }

  return result;
};
String.prototype.fQuery = async function fQuery(param) {
  const path = [baseUrl, '/', this, '.sql'].join('');
  let sql;
  let result;
  try {
    sql = fs.readFileSync(path, 'utf8');
  } catch (e) {
    return {
      type: 'error',
      onError: (res, id) => {
        const prm = {
          type: 'error',
          resultCode: 400,
          id: ['ERR', baseUrl, id].join('.'),
          errorMessage: e.toString(),
        };
        res.end(JSON.stringify(prm));
        return 'error';
      },
    };
  }
  Object.keys(param).forEach((key) => {
    const val = param[key];
    const regex = new RegExp(["'\\$\\{", key, "\\}'"].join(''), 'g'); // 백슬래시 두 번,  잊지 말 것!!
    if (val === null) {
      console.log('\n\n\n\n\n\n\n\n\n');
      console.log(key);
      console.log(sql);
      sql = sql.replace(regex, ['${', key, '}'].join(''));
      console.log(sql);
      console.log('\n\n\n\n\n\n\n\n\n');
    }

    const regex1 = new RegExp(['\\$\\{', key, '\\}'].join(''), 'g'); // 백슬래시 두 번,  잊지 말 것!!
    sql = sql.replace(regex1, val);
  });
  console.log(sql, '\n\n\n\n\n');

  try {
    result = await procQuery(sql);
  } catch (err) {
    console.log(err, '\n\n\n\n');
    result = {
      type: 'error',
      onError: (res, id, name, code) => {
        const prm = {
          type: 'error',
          resultCode: code || 400,
          id: ['ERR', baseUrl, id].join('.'),
          name: [name, 'query failed'].join(' '),
          errorMessage: err.toString(),
        };
        res.end(JSON.stringify(prm));
        return 'error';
      },
    };
  }

  return result;
};
