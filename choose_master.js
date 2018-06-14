var express = require('express');
var request = require('request');
const querystring = require('querystring');
var CHANNEL_ACCESS_TOKEN = 'BOpCS2JXlx/6DfqGmLVD9vU8FmjviF0TV/QJoLfkN0C465BHYiKtyfzP1Ov4wEIcF7xFvwu64T/RrO64+cai0dY7Th5yno/goN9+dJVa4EsLoNC5JV4mYF7ROws6Og6vfHByaSO/qQRZR8sy5Bz/twdB04t89/1O/w1cDnyilFU=';
var fs = require('fs');
const { Client } = require('pg');
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    //ssl: true,
    });

const app = express(); //建立一個express 伺服器
app.post('/' , linebotParser); // POST 方法**/
/**
 * expected result:
 *  user:@ok     
 *  bot:googleform
 *  user:done
 * 
 */

//data passing type by button:
    //0.act:
    function act(action){
        this.action=action;
    };

    //1.系籍:
    function department(department){
        this.department = department;
    }
    department.prototype = new act("department");        
    const psy = new department("psy");
    const phys = new department("phys");
    
    //2.學號:

    //button:
    const studentfrom= {
        "type": "template",
        "altText": "This is a buttons template",
        "template": {
            "type": "buttons",        
            "title": "你是誰派來的？",
            "text": "請選擇\"國北教心諮\"或\"台大物理\"",        
            "actions": [
                {
                  "type": "postback",
                  "label": "國北教心諮",
                  "data": querystring.stringify(psy)
                },
                {
                  "type": "postback",
                  "label": "台大物理",
                  "data": querystring.stringify(phys)
                }
            ]
        }
    };
    function recpt_studentfrom(id,department){
        psql("UPDATE ACCOUNT SET department=\'"+ department +"\' WHERE angle_id=\'" + id +"\';");
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
            /**var userMessage = post.events[0].message.text;
            console.log(replyToken);
            console.log(userMessage);**/
            if (typeof replyToken === 'undefined') {
                return;
            }
    
            if (posttype == 'message'){
                
                if(post.events[0].message.type == 'text'){
    
                    if(post.events[0].message.text == "@ok"){
                        record_angle_id(post.events[0].source.userId);
                        sendmessage(studentfrom);
                    }
                }
            }
    
            if (posttype == 'postback'){
                var data = post.events[0].postback.data;
                var act = querystring.parse(data);
    
                if( act.action == "department" ){
                    console.log("department accepted \"" + data.department + "\"");
                    recpt_studentfrom(post.events[0].source.userId , data.department);
                }
            }
    
            //var imgurl="https://angleline.herokuapp.com/img.jpg";
            if(post.events[0].message.type == 'image'){
                //set adrr
                adrr+=String(post.events[0].message.id);
                adrr+=".jpg";
                console.log(adrr);
                // Configure the request
                var getimage=new Promise((resolve,reject)=>{
                  var options = {
                    url: 'https://api.line.me/v2/bot/message/'+ post.events[0].message.id +'/content',
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
                  })              
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
                .then(sendmessage)
                .catch((err)=>{
                  console.log("(linebotpromise)"+err.message);
                }
                );          
            }else{
              sendmessage(nwimg);
            }
    
            function sendmessage(recpt){ //recpt is message object
              var options = {
                url: "https://api.line.me/v2/bot/message/reply ",
                method: 'POST',
                headers: {
                  'Content-Type':  'application/json', 
                  'Authorization':'Bearer ' + CHANNEL_ACCESS_TOKEN
                },
                json: {
                    'replyToken': replyToken,
                    'messages': [recpt]
                }
              };
              if(post.events[0].message.type == 'image'){
                    options.json.messages[0].originalContentUrl=(domain+adrr);
                    options.json.messages[0].previewImageUrl=(domain+adrr);
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
              
            }        
        });
    
    }