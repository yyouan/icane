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
     dev_name       |line_id        |times            | email              | last_call_time        |  stepcount | isgroup |ishost
    ----------------+---------------+-----------------+--------------------------------------------------------------------
    icane           | 0123456789012 | 0               | 0926372361         | JSON(year,month,date) | int        | 是／否  | 0/1
*/  

//login message with recpt function:
function record_dev_name(name,id,isgroup,email){
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
        "day" :day,
        "month":month,
        "year":year
    }

    psql("INSERT INTO ACCOUNTS (email) VALUES (\'"+ email +"\');").then(
        res =>{
            psql("UPDATE ACCOUNTS SET times=\'"+ "0" +"\' WHERE email=\'" + email +"\';");
            psql("UPDATE ACCOUNTS SET dev_name=\'"+ name +"\' WHERE email=\'" + email +"\';");
            psql("UPDATE ACCOUNTS SET isgroup=\'"+ isgroup +"\' WHERE email=\'" + email +"\';");
            psql("UPDATE ACCOUNTS SET ishost=\'"+ "0" +"\' WHERE email=\'" + email +"\';");
            psql("UPDATE ACCOUNTS SET last_call_time=\'"+ JSON.stringify(time) +"\' WHERE email=\'" + email +"\';"); 
            psql("UPDATE ACCOUNTS SET stepcount=0 WHERE email=\'" + email +"\';");
            psql("UPDATE ACCOUNTS SET line_id=\'"+ id +"\' WHERE email=\'" + email +"\';");  
        }
    );      
}
function create_dev_name(post,email,line_id){
        let google_url = 'https://docs.google.com/spreadsheets/d/1VWr1uoN0n9KD3h74G3P7HItf8-Hg2Pg9lN8ygJwQH7w/gviz/tq?tqx=out:html&tq=select%20*%20where%20G%20=%20%27';
        google_url += (email +'%27&gid=1591596252%27');
        var options = {
            url: google_url,
            method: 'GET'    
        }
        let dev_name = "";
        let isgroup = "";

        return new Promise( (resolve,reject)=>{

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
                  if (typeof doc.getElementsByTagName("tr")[1] === 'undefined'){
                      reject(isgroup);
                  }
                  else{
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
                        resolve(isgroup);                                    
                    }else{                
                        reject(isgroup);
                    }
                  }                              
                  
                }else{
                  console.log(error);
                  console.log("!!!!!error when recpt from google sheet!!!!!");              
                  reject(isgroup);               
                }
            });
        });
        
        
}
//var is_conn_psql = false;
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err)
    process.exit(-1)
})
  
function psql(command){
   
    return new Promise((resolve,reject)=>{
        //while(is_conn_psql){console.log("(psql):pararell gate");};
        //if(!is_conn_psql){client.connect();is_conn_psql = true;}
        let recpt =[];
        let error;
        console.log("(psql):" + command );
        pool.connect()
        .then(client=>{            
            client.query(command)
            .then(res => {
                client.release();
                for (let row of res.rows) {                
                    recpt.push(row);
                    console.log( "(psql-query):"+ JSON.stringify(row));
                }
                resolve(recpt);
                for(let row of recpt){
                    console.log( "(psql-query-recpt):"+ JSON.stringify(row));
                }
                console.log( "(psql-query-recpt):"+ recpt.length);    
            })
            .catch(e => {client.release(); console.error("(psql):" + e.stack);reject(e);});            
        });
    });
    
    
}

function linebotParser(req ,res){
    //route
    var nwimg;
    const domain="https://icane.herokuapp.com";  
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
                "text":"完成表單後，請輸入:\n[拐杖使用人手機號碼]\nex:0926-372-361"
            }
            replymessage([req,text]);            
        }
        
        if (posttype == 'message'){
            
            if(true){
                
                psql("SELECT * FROM ACCOUNTS WHERE line_id=\'" + line_id +"\';")
                .then( recpt =>{
                    if( recpt.length == 0)   
                    {
                        if(post.events[0].message.type == 'text'){
                            var email = post.events[0].message.text;
                            psql("SELECT * FROM ACCOUNTS WHERE email=\'" + email +"\';").then(recpt=>{
                                if( recpt.length == 0 )
                                {
                                    let text ={
                                        "type":"text",
                                        "text":""
                                    }

                                    create_dev_name(post,email,line_id)
                                    .then(
                                        (res)=>{text.text ="成功紀錄!";}
                                    )
                                    .catch(
                                        (res)=>{text.text ="還沒有填表單喔!";}
                                    ).then(
                                        ()=>{replymessage([text]);}                                        
                                    );
                                    
                                }else{
                                    let text ={
                                        "type":"text",
                                        "text":""
                                    }
                                    text.text ="這個手機號碼註冊過了喔!";
                                    replymessage([text]);                        
                                }
                            });
                        }else{
                            let text ={
                                "type":"text",
                                "text":""
                            }
                            text.text ="EASTER_EGG!請輸入正確訊息";
                            replymessage([text]);
                        }                        

                    }else{
                        let gate = false;

                        if(post.events[0].message.type == 'text'){

                            gate = true;
                            var email = post.events[0].message.text;
                            if(email=="@iwantbehost"){
                                psql("UPDATE ACCOUNTS SET ishost=\'"+ "1" +"\' WHERE line_id=\'" + line_id +"\';");
                                let text ={
                                    "type":"text",
                                    "text":""
                                }
                                text.text ="您已成為管理員!";
                                replymessage([text]);                             
                            }
                            else if(email.substr(0,5)=="@add:"){
                                console.log(email);
                                let rawdata = email.substr(5);
                                let data = querystring.parse(rawdata);
                                let name = data.dev;
                                let phone = data.phone;
                                record_dev_name(name,line_id,"1",phone);
                            
                                let text ={
                                    "type":"text",
                                    "text":""
                                }
                                text.text = name+"裝置已加入!";;
                                replymessage([text]);
                            }else{
                                gate = false;
                            }

                        }

                        if(gate == false){
                                                       
                            let text1 ={
                                "type":"text",
                                "text":""
                            }
                            text1.text = "您的回饋已經傳送給官方!";
                            var sent =[text1];                            

                            if(recpt.length == 1){
                                var dev = recpt[0].dev_name;
                                let msg = post.events[0].message;                                    
                                let type = msg.type;
                                let msgid = msg.id;                                
                                let ishost = recpt[0].ishost;
                                if(type == 'image'){
                                    //set adrr
                                    adrr+=String(msgid);
                                    adrr+=".jpg";
                                    console.log(adrr);
                                    // Configure the request
                                    let getimage=new Promise((resolve,reject)=>{
                                    let options = {
                                        url: 'https://api.line.me/v2/bot/message/'+ msgid +'/content',
                                        method: 'GET',
                                        headers: {                
                                        'Authorization':'Bearer ' + CHANNEL_ACCESS_TOKEN                  
                                        },
                                        encoding: null
                                    }
                        
                                    // Start the request

                                    request(options, function (error, response, body) {
                                        if (!error && response.statusCode == 200) {
                                        nwimg = body;
                                        console.log(body);
                                        resolve(body);                  
                                        }else{
                                        //console.log();
                                        reject("!!!!!error when recpt image!!!!!");                
                                        }
                                    });              
                                    });
                                    
                                    getimage            
                                    .then((body)=>{
                                    //fs.writeFile(__dirname+"/img.jpg","");
                                    /**fs.writeFile(__dirname+"/img.jpg",body,(err)=>{
                                        if(err){
                                        console.log("(writefile)"+err);
                                        }else{                  
                                        console.log("the file was saved");
                                        //console.log(body);
                                        }
                                    });**/              
                                    return Promise.resolve(body); 
                                    })
                                    .then(let_pushmessage)
                                    .catch((err)=>{
                                    console.log("(linebotpromise)"+err);
                                    }
                                    );          
                                }else{
                                    let_pushmessage(nwimg);
                                }

                                function let_pushmessage(recpt){
                                    let text ={
                                        "type":"text",
                                        "text":""
                                    }                                        

                                    if(ishost == "1"){
                                        text.text="管理員：";
                                    }else{
                                        text.text="某監理帳號：";
                                    }

                                    psql("SELECT * FROM ACCOUNTS WHERE dev_name=\'" + dev +"\' and line_id!=\'"+ line_id+"\';").then( clients =>{
                                        for(client of clients){
                                            var options = {
                                                url: "https://api.line.me/v2/bot/message/push",
                                                method: 'POST',
                                                headers: {
                                                'Content-Type':  'application/json', 
                                                'Authorization':'Bearer ' + CHANNEL_ACCESS_TOKEN
                                                },
                                                json: {
                                                    'to': client.line_id.replace(/\s+/g, ""),
                                                    'messages': [text,msg]
                                                }
                                            };
                                            if(type == 'image'){
                                                    options.json.messages[1].originalContentUrl=(domain+adrr);
                                                    options.json.messages[1].previewImageUrl=(domain+adrr);
                                                    //options.json.messages[0].text +="\n";
                                                    //options.json.messages[0].text +=(domain+adrr);
                                                    app.get(adrr,(req,res)=>{
                                                    //res.sendFile(__dirname+"/img.jpg");    
                                                    res.writeHead(200, {'Content-Type': 'image/jpeg' });
                                                    res.end(nwimg, 'binary');
                                                    });
                                            }  
                                            request(options, function (error, response, body) {
                                                if (error) throw error;
                                                console.log("(line)");
                                                console.log(body);
                                            });
                                            //create server
                                        }                                            
                                    });                                       
      
                                }  
                            }else{
                                let button = {
                                    "type": "template",
                                    "altText": "This is a buttons template",
                                    "template": {
                                        "type": "buttons",                    
                                        "text": "按這裡註冊資料",                                        
                                        "actions": []
                                    }
                                };

                                let uri_text ={
                                    "type":"text",
                                    "text":""
                                }
                                
                                for(let dev of recpt){
                                    let choice = {
                                        "type": "uri",
                                        "label": dev.dev_name.replace(/\s+/g, ""),
                                        "uri": "https://icane.herokuapp.com/choice?"+querystring.stringify({ ishost: recpt[0].ishost ,line_id: line_id,dev_name: dev.dev_name.replace(/\s+/g, ""), msg :JSON.stringify(post.events[0].message)}) 
                                    }
                                    console.log(choice.uri);
                                    console.log(choice.label);
                                    button.template.actions.push(choice); 
                                    uri_text.text +=choice.uri;
                                    uri_text.text +="\n";                                   
                                }
                                sent.push(uri_text);
                                sent.push(button);
                            };

                            replymessage(sent);

                            app.get('/choice',(req,res)=>{

                                //route
                                let nwimg;
                                const domain="https://icane.herokuapp.com";  
                                let adrr="/";
                                                                    
                                    let q = url.parse(req.url,true);
                                    console.log(q.search.substr(1)); //?dev_name=...
                                    let data =querystring.parse(q.search.substr(1));

                                    let dev = data.dev_name;
                                    let msg = JSON.parse(data.msg);                                    
                                    let type = msg.type;
                                    let msgid = msg.id;
                                    let line_id = data.line_id;
                                    let ishost = data.ishost;

                                    if(type == 'image'){
                                        //set adrr
                                        adrr+=String(msgid);
                                        adrr+=".jpg";
                                        console.log(adrr);
                                        // Configure the request
                                        let getimage=new Promise((resolve,reject)=>{
                                        let options = {
                                            url: 'https://api.line.me/v2/bot/message/'+ msgid +'/content',
                                            method: 'GET',
                                            headers: {                
                                            'Authorization':'Bearer ' + CHANNEL_ACCESS_TOKEN                  
                                            },
                                            encoding: null
                                        }
                            
                                        // Start the request

                                        request(options, function (error, response, body) {
                                            if (!error && response.statusCode == 200) {
                                            nwimg = body;
                                            console.log(body);
                                            resolve(body);                  
                                            }else{
                                            //console.log();
                                            reject("!!!!!error when recpt image!!!!!");                
                                            }
                                        });              
                                        });
                                        
                                        getimage            
                                        .then((body)=>{
                                        //fs.writeFile(__dirname+"/img.jpg","");
                                        /**fs.writeFile(__dirname+"/img.jpg",body,(err)=>{
                                            if(err){
                                            console.log("(writefile)"+err);
                                            }else{                  
                                            console.log("the file was saved");
                                            //console.log(body);
                                            }
                                        });**/              
                                        return Promise.resolve(body); 
                                        })
                                        .then(let_pushmessage)
                                        .catch((err)=>{
                                        console.log("(linebotpromise)"+err);
                                        }
                                        );          
                                    }else{
                                        let_pushmessage(nwimg);
                                    }

                                    function let_pushmessage(recpt){
                                        let text ={
                                            "type":"text",
                                            "text":""
                                        }                                        

                                        if(ishost == "1"){
                                            text.text="管理員：";
                                        }else{
                                            text.text="某監理帳號：";
                                        }

                                        psql("SELECT * FROM ACCOUNTS WHERE dev_name=\'" + dev +"\' and line_id!=\'"+ line_id+"\';").then( clients =>{
                                            for(client of clients){
                                                var options = {
                                                    url: "https://api.line.me/v2/bot/message/push",
                                                    method: 'POST',
                                                    headers: {
                                                    'Content-Type':  'application/json', 
                                                    'Authorization':'Bearer ' + CHANNEL_ACCESS_TOKEN
                                                    },
                                                    json: {
                                                        'to': client.line_id.replace(/\s+/g, ""),
                                                        'messages': [text,msg]
                                                    }
                                                };
                                                if(type == 'image'){
                                                        options.json.messages[1].originalContentUrl=(domain+adrr);
                                                        options.json.messages[1].previewImageUrl=(domain+adrr);
                                                        //options.json.messages[0].text +="\n";
                                                        //options.json.messages[0].text +=(domain+adrr);
                                                        app.get(adrr,(req,res)=>{
                                                        //res.sendFile(__dirname+"/img.jpg");    
                                                        res.writeHead(200, {'Content-Type': 'image/jpeg' });
                                                        res.end(nwimg, 'binary');
                                                        });
                                                }  
                                                request(options, function (error, response, body) {
                                                    if (error) throw error;
                                                    console.log("(line)");
                                                    console.log(body);
                                                });
                                                //create server
                                            }                                            
                                        });                                       
          
                                    }        
    

                            });
                        }
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

    var month = date.getMonth()+1;
    month = (month < 10 ? "0" : "") + month;

    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    var time = {
        "min":min,
        "hour":hour,
        "day" :day,
        "month":month,
        "year":year
    }

    psql("UPDATE ACCOUNTS SET last_call_time=\'"+ JSON.stringify(time) +"\' WHERE dev_name=\'" + dev +"\';");
    psql("SELECT * FROM ACCOUNTS WHERE dev_name=\'" + dev +"\';").then( recpt =>{
        let stepcount = recpt[0].stepcount;
        let email = recpt[0].email;
        stepcount += parseInt(data.step);
        psql("UPDATE ACCOUNTS SET stepcount="+ stepcount +" WHERE dev_name=\'" + dev +"\';");
        return [stepcount,email];
    })
    .then( res =>{
        
        let stepcount = res[0];
        let email = res[1];

        var msg ={  
            "type": "flex",
            "altText": "this is a flex message",
            "contents": {
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
                      "text": "裝置代碼: " +dev
                    },
                    {
                      "type": "text",
                      "text": "角度狀態： "+ ((data.ang=='0')?"|| Standing ||":"= Lying ="),
                    },                
                    {
                        "type": "text",
                        "text": "是否拿著？ "+ ((data.isactive=='0')?"沒拿":"拿著"),
                    },
                    {
                        "type": "text",
                        "text": "本日腳步數： "+ stepcount +"步",
                    }                
                  ]
                }            
            }
        };
    
        var errormsg = {  
            "type": "flex",
            "altText": "this is a flex message",
            "contents":
                {
                    "type": "bubble",
                    "header": {
                    "type": "box",
                    "layout": "vertical",
                    "contents": [
                        {
                        "type": "text",
                        "text": dev 
                        }
                    ]
                    },
                    "hero": {
                        "type": "image",
                        "url": "https://i.imgur.com/PGDhuIT.jpg", //use 圖片位址
                    },
                    "body": {
                      "type": "box",
                      "layout": "vertical",
                      "contents": [
                        {
                          "type": "text",
                          "text": "故障訊息(連線／感測器)，請趕緊通話聯繫，確認狀況",
                        },
                        {
                            "type": "text",
                            "text": "請撥打:" + email,
                        }                
                      ]
                    }              
                }
        };
        
        if( data.alarm == 1){
            msg.contents.header.contents[0].text = "跌倒了!!->快聯繫:"+ email;
            msg.contents.hero = {
                "type": "image",
                "url": "https://i.imgur.com/zkmwlLW.jpg",
            }
        }
    
        var recpt=[msg];
        if(data.error == 1){
            recpt.push(errormsg);
        };
        

        psql("SELECT line_id FROM ACCOUNTS WHERE dev_name=\'" + data.dev_name +"\';").then(family=>{
                let family_num = 0;
                for(let member of family){  //in:for json(only get key,in this case is 0) //of :for array
                    pushmessage(recpt , member.line_id.replace(/\s+/g, ""));
                    console.log(member.line_id);
                    family_num++;
                }
                console.log(family_num);               
        });
    });
}

function pushmessage(recpt,id){
    recpt.forEach(element => {
        console.log("pushmessage:"+element);
    });

    var options = {
        url: "https://api.line.me/v2/bot/message/push",
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
betteryschedule();
function betteryschedule(){
    schedule.scheduleJob('15 * * * *',scanAccount);
    schedule.scheduleJob('30 * * * *',scanAccount);
    schedule.scheduleJob('45 * * * *',scanAccount);
    schedule.scheduleJob('00 * * * *',scanAccount);
    schedule.scheduleJob('00 * * * * *',scanAccount);//test
    
    function scanAccount(){
        var date = new Date();
        var min  = date.getMinutes();
        var hour  = date.getHours();
        var day  = date.getDate();
        var month  = (date.getMonth()+1);
        var year = date.getFullYear();

        psql("SELECT * FROM ACCOUNTS;").then( clients =>{

            for(let client of clients){
                var clientmin=parseInt(JSON.parse(client.last_call_time).min);
                var clienthour=parseInt(JSON.parse(client.last_call_time).hour);
                var clientday=parseInt(JSON.parse(client.last_call_time).day);
                var clientmonth= (parseInt(JSON.parse(client.last_call_time).month));
                var clientyear=parseInt(JSON.parse(client.last_call_time).year);
                var alarm = false;
                console.log([clientmin,clienthour,clientday,clientmonth,clientyear].toString());
                console.log([min,hour,day,month,year].toString());
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
                        "type": "flex",
                        "altText": "this is a flex message",
                        "contents":
                            {
                                "type": "bubble",
                                "header": {
                                "type": "box",
                                "layout": "vertical",
                                "contents": [
                                    {
                                    "type": "text",
                                    "text": client.dev_name
                                    }
                                ]
                                },
                                "hero": {
                                    "type": "image",
                                    "url": "https://i.imgur.com/PGDhuIT.jpg", //use 圖片位址
                                },
                                "body": {
                                  "type": "box",
                                  "layout": "vertical",
                                  "contents": [
                                    {
                                      "type": "text",
                                      "text": "故障訊息(連線／沒電)，請趕緊通話聯繫，確認狀況",
                                    },
                                    {
                                        "type": "text",
                                        "text": "請撥打:" + client.email,
                                    }              
                                  ]
                                }              
                            }
                    };
                    pushmessage([errormsg],client.line_id.replace(/\s+/g, ""));
                }
            }
        });
        
    }
}