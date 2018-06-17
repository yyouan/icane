var express = require('express');
var request = require('request');
const querystring = require('querystring');
var CHANNEL_ACCESS_TOKEN = 'BBeO0lDVdZMnLDSONXfZlhniK9gjIK+FqzOoEz6lcgQ9g9CzqsDesBTS/o15Mw9ipLtAk4fP0aPIWojmZxbXXiWV6OANuZ6j+YYvrCK89rJovI6yXnTRt9G/8AedFPcfeMqwKWmsQB6KY+jAZoZFPwdB04t89/1O/w1cDnyilFU=';
var fs = require('fs');
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    //ssl: true,
});
var DomParser = require('dom-parser');
var url = require('url');
var schedule = require('node-schedule');

const app = express(); //建立一個express 伺服器
app.post('/' , linebotParser); // POST 方法**/
app.get('/data',datareceiver);
/**
 * expected result:
 *  user:@ok     
 *  bot:googleform
 *  user:done
 * 
 */

//SQL
/**
     dev_name       |line_id        |times            | email              | last_call_time        |  stepcount | isgroup
    ----------------+---------------+-----------------+--------------------------------------------------------------------
    icane           | 0123456789012 | 0               | xu.6u.30@gmail.com | JSON(year,month,date) | int        | 是／否
*/  

//login message with recpt function:
function record_dev_name(name,id,isgroup,email){

    psql("INSERT INTO ACCOUNTS (email) VALUES (\'"+ email +"\');").then(
        res =>{
            psql("UPDATE ACCOUNTS SET times=\'"+ "0" +"\' WHERE email=\'" + email +"\';");
            psql("UPDATE ACCOUNTS SET dev_name=\'"+ name +"\' WHERE email=\'" + email +"\';");
            psql("UPDATE ACCOUNTS SET isgroup=\'"+ isgroup +"\' WHERE email=\'" + email +"\';");
            psql("UPDATE ACCOUNTS SET last_call_time=\'\' WHERE email=\'" + email +"\';"); 
            psql("UPDATE ACCOUNTS SET stepcount=0 WHERE email=\'" + email +"\';");
            psql("UPDATE ACCOUNTS SET line_id=\'"+ id +"\' WHERE email=\'" + email +"\';");  
        }
    );      
}
function create_dev_name(email,line_id){
        let google_url = 'https://docs.google.com/spreadsheets/d/1VWr1uoN0n9KD3h74G3P7HItf8-Hg2Pg9lN8ygJwQH7w/gviz/tq?tqx=out:html&tq=select%20*%20where%20E%20=%20%27';
        google_url += (email +'%27&gid=1591596252%27');
        var options = {
            url: google_url,
            method: 'GET'    
        }
        let dev_name = "";
        let isgroup = "";
        request(options, function (error, response, body) {
            if (!error && response.statusCode == 200) {
              console.log("(crt_dev_name)"+options.url);
              console.log("(crt_dev_name)"+email);
              console.log("(crt_dev_name)"+line_id);
              console.log(body);              
              //console.log(typeof(body));
              var parser = new DomParser();
              var doc = parser.parseFromString(body, "text/xml");
              console.log(doc.getElementsByTagName("tr"));
              console.log(doc);
              var values = doc.getElementsByTagName("tr")[1].getElementsByTagName("td");
              for (let value of values){
                console.log(value.innerHTML);
              }
              dev_name = values[1].innerHTML;
              isgroup = values[5].innerHTML;              
              console.log("dev_name:"+ dev_name);
              console.log("is_group:"+ isgroup);
              if(dev_name !="&nbsp" && isgroup !="&nbsp"){
                record_dev_name(dev_name,line_id,isgroup,email);                
              }else{
                var req = post.events[0].message;
                req.text ="您還沒填表單喔!";
                replymessage([req]);
              }             
              
            }else{
              console.log(error);
              reject("!!!!!error when recpt from google sheet!!!!!");                
            }
        });
}
//var is_conn_psql = false;
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err)
    process.exit(-1)
})
  
function psql(command){
   
    
    //while(is_conn_psql){console.log("(psql):pararell gate");};
    //if(!is_conn_psql){client.connect();is_conn_psql = true;}
    console.log("(psql):" + command );
    var pool_promise = 
    pool.connect()
    .then(client=>{
        let recpt =[];
        var res;
        client.query(command)
        .then(res => {
            client.release();
            for (let row of res.rows) {                
                recpt += row;
                console.log( "(psql-query):"+ JSON.stringify(row));
            }    
        }).catch(e => {client.release(); console.error("(psql):" + e.stack);});
        return recpt;
    })
    .then( recpt=> {
        for(let row of recpt){
            console.log( "(psql-query):"+ JSON.stringify(row));
        } 
        return recpt;
    })
    .catch(e => {
        client.release();
        console.log("(psql):" + err.stack);
        for(let row of recpt){
            console.log( "(psql-query):"+ JSON.stringify(row));
        }        
        return recpt;      
    });    
    
    return pool_promise;
}

function linebotParser(req ,res){
    //route
    var nwimg;
    const domain="https://angleline.herokuapp.com";  
    var adrr="/";
    
    // 定义了一个post变量，用于暂存请求体的信息
    var post = '';     
    // 通过req的data事件监听函数，每当接受到请求体的数据，就累加到post变量中
    req.on('data', function(chunk){   
        post += chunk;
    });
 
    // 在end事件触发后，通过querystring.parse将post解析为真正的POST请求格式，然后向客户端返回。
    req.on('end', function(){    
        post = JSON.parse(post);
        console.log(post.events[0]);
        var replyToken = post.events[0].replyToken;
        var posttype = post.events[0].type;
        var line_id = post.events[0].source.userId;
        let isgroup = false;
        if (post.events[0].source.type =="group"){
            line_id = post.events[0].source.groupId;
            isgroup = true;
        }
        /**var userMessage = post.events[0].message.text;
        console.log(replyToken);
        console.log(userMessage);**/
        if (typeof replyToken === 'undefined') {
            return;
        }
        if (posttype == 'join'){
            let req = {
                "type": "template",
                "altText": "This is a buttons template",
                "template": {
                    "type": "buttons",                    
                    "text": "按這裡註冊資料",
                    "defaultAction": {
                        "type": "uri",
                        "label": "View detail",
                        "uri": "https://goo.gl/forms/Uv2vKNKdETVQpEmu2"
                    },
                    "actions": [
                        {
                          "type": "uri",
                          "label": "View detail",
                          "uri": "https://goo.gl/forms/Uv2vKNKdETVQpEmu2"
                        }
                    ]
                }
            };
            let text ={
                "type":"text",
                "text":"完成表單後，請輸入:\n[您的電子郵件地址]\nex:xu.6u.30@gmail.com"
            }
            replymessage([req,text]);            
        }
        
        if (posttype == 'message'){
            
            if(post.events[0].message.type == 'text'){
                
                psql("SELECT * FROM ACCOUNTS WHERE line_id=\'" + line_id +"\';")
                .then( recpt =>{
                    if( recpt.length == 0)   
                    {
                        var email = post.events[0].message.text;
                        psql("SELECT * FROM ACCOUNTS WHERE email=\'" + email +"\';").then(recpt=>{
                            if( recpt.length == 0 )
                            {
                                create_dev_name(email,line_id);                        
                                var req = post.events[0].message;
                                req.text ="成功紀錄!";
                                replymessage([req]);

                            }else{
                                var req = post.events[0].message;
                                req.text ="這個郵件信箱註冊過了喔!";
                                replymessage([req]);                        
                            }
                        });

                    }else{
                        var req = post.events[0].message;
                        req.text ="您的回饋已經傳送給官方!";
                        replymessage([req]);
                    }    
                });                
                            
            }
        }        

        function replymessage(recpt){ //recpt is message object
          var options = {
            url: "https://api.line.me/v2/bot/message/reply ",
            method: 'POST',
            headers: {
              'Content-Type':  'application/json', 
              'Authorization':'Bearer ' + CHANNEL_ACCESS_TOKEN
            },
            json: {
                'replyToken': replyToken,
                'messages': recpt
            }
          };
            
          request(options, function (error, response, body) {
              if (error) throw error;
              console.log("(line)");
              console.log(body);
          });
          
        }        
    });

}

function datareceiver(req,res){
    var q = url.parse(req.url,true);
    console.log(q.query); //?dev_name=....&alarm=.....

    var data = q.query;
    var dev = data.dev_name;

    var date = new Date();
    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    var min  = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    var year = date.getFullYear();

    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    var time = {
        "min":min,
        "hour":hour,
        "month":month,
        "year":year
    }

    psql("UPDATE ACCOUNTS SET last_call_time=\'"+ JSON.stringify(time) +"\' WHERE dev_name=\'" + dev +"\';");
    psql("SELECT stepcount FROM ACCOUNTS WHERE dev_name=\'" + dev +"\';").then( recpt =>{
        let stepcount = recpt.stepcount;
        stepcount += parseInt(data.step);
        psql("UPDATE ACCOUNTS SET stepcount="+ stepcount +" WHERE dev_name=\'" + dev +"\';");
        return stepcount;
    })
    .then( stepcount =>{

        var msg ={
            "type": "bubble",
            "header": {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "text",
                  "text": "一般通知訊息"
                }
              ]
            },
            "body": {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "text",
                  "text": "角度狀態： "+ (data.ang=='0')?"Standing":"Lying",
                },                
                {
                    "type": "text",
                    "text": "是否拿著？ "+ (data.isactive=='0')?"沒拿":"拿著",
                },
                {
                    "type": "text",
                    "text": "本日腳步數： "+ stepcount +"步",
                }                
              ]
            }            
        };
    
        var errormsg={
            "type": "bubble",
            "header": {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "text",
                  "text": "故障訊息(連線／感測器)"
                }
              ]
            },
            "hero": {
                "type": "image",
                "url": "https://photos.app.goo.gl/YbnwnaCfCZFCGLEL9",
            }            
        };
        
        if( data.alarm == 1){
            msg.header.contents[0].text = "!!警示訊息!!";
            msg.hero = {
                "type": "image",
                "url": "https://photos.app.goo.gl/j2hwSjuqgRFNPBhG9",
            }
        }
    
        var recpt=[msg];
        if(data.error == 1){
            recpt += errormsg;
        };
        let family_member = [];

        psql("SELECT line_id FROM ACCOUNTS WHERE dev_name=\'" + data.dev_name +"\';").then(family=>{
                for(let member in family){
                    family_member += member.line_id;
                }
                return family_member; 
        })
        .then( family_member =>{
            console.log(family_member);
            pushmessage(recpt,family_member);
        });
    });
}

function pushmessage(recpt,id){

    var options = {
        url: "https://api.line.me/v2/bot/message/push ",
        method: 'POST',
        headers: {
          'Content-Type':  'application/json', 
          'Authorization':'Bearer ' + CHANNEL_ACCESS_TOKEN
        },
        json: {
            "to": id,
            'messages': recpt
        }
      };
        
      request(options, function (error, response, body) {
          if (error) throw error;
          console.log("(line)");
          console.log(body);
      });

}

//因為 express 預設走 port 3000，而 heroku 上預設卻不是，要透過下列程式轉換
var server = app.listen((process.env.PORT || 8080), function() {
    var port = server.address().port;
    console.log("App now running on port", port);
});
//!!!!!

//--------------always on----------------------------
function betteryschedule(){
    schedule.scheduledJob('0 15 * * * *',scanAccount);
    schedule.scheduledJob('0 30 * * * *',scanAccount);
    schedule.scheduledJob('0 45 * * * *',scanAccount);
    schedule.scheduledJob('0 00 * * * *',scanAccount);
    
    function scanAccount(){
        var date = new Date();
        var min  = date.getMinutes();
        var hour  = date.getHours();
        var day  = date.getDate();
        var month  = date.getMonth();
        var year = date.getFullYear();

        psql("SELECT line_id,last_call_time FROM ACCOUNTS;").then( clients =>{

            for(let client of clients){
                var clientmin=parseInt(JSON.parse(client.last_call_time).min);
                var clienthour=parseInt(JSON.parse(client.last_call_time).hour);
                var clientday=parseInt(JSON.parse(client.last_call_time).day);
                var clientmonth=parseInt(JSON.parse(client.last_call_time).month);
                var clientyear=parseInt(JSON.parse(client.last_call_time).year);
                var alarm = false;
    
                if( ( (min - clientmin) < 30 && [clienthour,clientday,clientmonth,clientyear].toString()==[hour,day,month,year].toString() ) 
                || ( (min==15) && ((75-clientmin) <30 ) && ( ( (hour-clienthour)==1 && [clientday,clientmonth,clientyear].toString()==[day,month,year].toString() )
                || ((hour=0) && (clienthour == 23) && ( ( (day-clientday)==1 && [clientmonth,clientyear].toString()==[month,year].toString() )
                || ((day==1) && (
                (([clientday,clientmonth].toString() == [28,2].toString() 
                || [clientday,clientmonth].toString() == [29,2].toString()
                || [clientday,clientmonth].toString() == [31,1].toString()
                || [clientday,clientmonth].toString() == [31,3].toString()
                || [clientday,clientmonth].toString() == [30,4].toString()
                || [clientday,clientmonth].toString() == [31,5].toString()
                || [clientday,clientmonth].toString() == [30,6].toString()
                || [clientday,clientmonth].toString() == [31,7].toString()
                || [clientday,clientmonth].toString() == [31,8].toString()
                || [clientday,clientmonth].toString() == [30,9].toString()
                || [clientday,clientmonth].toString() == [31,10].toString()
                || [clientday,clientmonth].toString() == [30,11].toString()
                ) && clientyear==year)
                ||
                (
                    [clientday,clientmonth].toString() == [31,12].toString()
                    && (year-clientyear)==1
                )
                )))
                )))){}
                else{
                    var errormsg={
                        "type": "bubble",
                        "header": {
                          "type": "box",
                          "layout": "vertical",
                          "contents": [
                            {
                              "type": "text",
                              "text": "故障訊息(連線／沒電)"
                            }
                          ]
                        },
                        "hero": {
                            "type": "image",
                            "url": "https://photos.app.goo.gl/YbnwnaCfCZFCGLEL9",
                        }            
                    };
                    pushmessage([recpt],client);
                }
            }
        });
        
    }
}