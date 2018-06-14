var express = require('express');
var request = require('request');
const querystring = require('querystring');
var CHANNEL_ACCESS_TOKEN = 'BOpCS2JXlx/6DfqGmLVD9vU8FmjviF0TV/QJoLfkN0C465BHYiKtyfzP1Ov4wEIcF7xFvwu64T/RrO64+cai0dY7Th5yno/goN9+dJVa4EsLoNC5JV4mYF7ROws6Og6vfHByaSO/qQRZR8sy5Bz/twdB04t89/1O/w1cDnyilFU=';
var fs = require('fs');
const { Client } = require('pg');
const sqlclient = new Client({
    connectionString: process.env.DATABASE_URL,
    //ssl: true,
});

const app = express(); //建立一個express 伺服器

const sqlclient2 = new Client({
  connectionString: process.env.DATABASE_URL,  
                    //postgres://slyodakbbttdhs:968361395e30506915fb61997e79852b3a6f633c110d503411a4fdbc1aea8b9c@ec2-107-21-103-146.compute-1.amazonaws.com:5432/d8inumnm21ppuh
  ssl: true,
});
//console.log(process.env.DATABASE_URL);
sqlclient.connect();

sqlclient.query('SELECT angle_id FROM ACCOUNT WHERE student_id=\'b05202030\';', (err, res) => {
  if (err) throw err;
  //console.log(err);
  console.log(res.rows[0]);
  console.log(res.rows[0].angle_id);
  for (let row of res.rows) {
    //console.log(JSON.stringify(row));
    console.log(row);
    console.log(row.angle_id);
  }
  sqlclient.end();
});

//因為 express 預設走 port 3000，而 heroku 上預設卻不是，要透過下列程式轉換
var server = app.listen((process.env.PORT || 8080), function() {
  var port = server.address().port;
  console.log("App now running on port", port);
});
//!!!