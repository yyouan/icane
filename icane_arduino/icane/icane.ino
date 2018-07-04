#include <SoftwareSerial.h>
//#include <SPI.h>
//#include <SD.h>
#define _baudrate   115200
#define _rxpin      4
#define _txpin      5
#define _touchpin  2
#define _anglepin 3
#define _beeppin 7
#define _clock 9 //(500HZ)
const int duty=127; //(1ms)
#define _vibratepin 0 //A0
SoftwareSerial debug( _rxpin, _txpin ); // RX, TX
//*-- IoT Information

#define SSID "iPhone"
#define PASS "0956016618"
const String DEV_NAME = "icane01";
const boolean connNTU = false;
const boolean serial=true;
boolean is_sd = false;
//------------sd card para-------------------
/**File myFile;

// 設定 SD library 功能變數:

Sd2Card card;
SdVolume volume;
SdFile root;

const int chipSelect = 8;
const int sd_pin = 8;
const int sd_pow_pin = 7;
**/

//----------------todo-------------------------
/**
 * 1.reduce 配重，sensor太靈敏
 */
//---------------------------------------------

//----------------test_work--------------------
/**
 * 1.connect to NTU
 * 2.compile
 * 3.use reset button to "stop beeping"
 * 4.lift the cane and let it flow down
 * 5.old man hold the cane and hit someone
 */
//---------------------------------------------

//--------------------parameter----------------
const int _touchgate=500; //(untouch less than _touchgate viewed as "touched") //(dealta h=1m)
const int _vibrategate=800;
const int _noflipvibgate=1000;
const bool _standingangle=0; // (_ : 1 ; | : 0)
const int _flipvibsensetime=1000;
const int  _touchtimegate=200;

const int _stepHIGH=600;
const int _stepLOW=580;
const int _step_flushing_time=(1000*60*1);
const int _steptime = 100;

const int _angle_fluct_time=50; //(delta h=1cm)

const int _battery_call_period=30000; //with conn error detecting
const int _max_recursion=1;
const int _alarm_reset_button_time=3000;

const int _alarm_reset_button_on=HIGH;
const int _touched=HIGH;

const int _buffertime=20;//second
const int _max_data_inpackage=1000; 
//---------------------------------------------

#define IP "184.106.153.149" // ThingSpeak IP Address: 184.106.153.149
// 使用 GET 傳送資料的格式
// GET /update?key=[THINGSPEAK_KEY]&field1=[data 1]&filed2=[data 2]...;
String GET = "GET /update?key=7LKVJXP7BOYEJE58";
volatile bool istouch=0;
volatile bool angle=0,alarm=0,isactive=0;
volatile unsigned long lasttouchtime=0;
volatile unsigned long lastangletime=0;
volatile unsigned long lastbatterytime=0;
volatile unsigned long laststepcounttime=0;
unsigned long lastvibcounttime=0;
volatile bool isintr=0;
int stepcount=0;
bool error=0;
bool connerror=0;
int times=0;
int maxvibrate=0;

//--------------buffer------------------------------------
/**struct Record
{
   short vibrate;
   bool angle;
   bool alarm;
   bool isactive;
};
Record buffermem[_max_data_inpackage];
int bufferptr=0;
void storeBuffer(String Vib, String Ang, String Alarm,String Isactive){
  Record data;
  data.vibrate=Vib;
  data.angle=Ang;
  data.alarm=Alarm;
  data.isactive=Isactive;
  if(bufferptr>(_max_data_inpackage-1)){
    for(int i=0;i<(_max_data_inpackage-1);++i){
      buffermem[i]=buffermem[i+1];
    }
    buffermem[_max_data_inpackage-1]=data;
  }
  else{
    buffermem[bufferptr]=data;
    bufferptr++;
  }
}
void resetBuffer(){
  bufferptr=0;
};
**/
//----------------------------------------------------------

void setup() {      
    Serial.begin( _baudrate );
    debug.begin( _baudrate );
    //sendDebug("AT");
    //Loding("sent AT");
    
    //---you need to delete them
    connectWiFi();
    errorhandler();
    //-------------//
            
    pinMode(_touchpin,INPUT);
    pinMode(_anglepin,INPUT);
    pinMode(_beeppin,OUTPUT);
    pinMode(_clock,OUTPUT);
    attachInterrupt(0,changetouch,CHANGE); //pin2
    attachInterrupt(1,changeangle,CHANGE); //pin3

    //digitalWrite(_beeppin,HIGH);
    analogWrite(_clock,127);

    //sd card setup
    /**pinMode(sd_pow_pin,OUTPUT);
    digitalWrite(sd_pow_pin,HIGH);
    
    Serial.println("\nWaiting for SD card ready...");
    while (true) {
      if(SD.begin(sd_pin)){
      is_sd = true;            
      console("--------------------------------------");
      console("SD_start!");
      break;
      }
      else{
        continue;
      }   
  }**/
}
void loop() {
    //test
    //delay(1000);
    //SentOnCloud(String(0),String(0),String(0),String(isactive),String(0),String(error));
    Serial.println(digitalRead(_touchpin));         
    isintr=0;
    tracetouch();    
    countstep();
    while(isintr==1){console("I'm in intr_1=>"+ String(isintr));isintr=0;countstep();alarmreset();}
    betterycall();
    senseVibrate();
    Alarm();
    alarmreset();
    while(isintr==1){console("I'm in intr_2 =>"+ String(isintr));isintr=0;Alarm();alarmreset();}
    alarmbeep();
    while(isintr==1){console("I'm in intr_3=>"+ String(isintr));isintr=0;Alarm();alarmbeep();alarmreset();alarmbeep();}
    if(alarm==1)SentOnCloud(String(analogRead(_vibratepin)),String(angle),String(alarm),String(isactive),String(0),String(error & isintr));
    while(isintr==1){console("I'm in intr_4=>"+ String(isintr));isintr=0;Alarm();alarmreset();alarmbeep();if(alarm==1)SentOnCloud(String(analogRead(_vibratepin)),String(angle),String(alarm),String(isactive),String(0),String(error & isintr));}
    
    //you need to delete it if don't need wifi---------
    errorhandler();
    //    
}
void connectWiFi()
{
    debug.println("AT+CWMODE=1");
    if(connNTU==true){if(!Connect_to_NTU()){console("Something went wrong conn to NTU");}}
    else Wifi_connect();
}

void SentOnCloud(String Vib,String Ang, String Alarm,String Isactive,String Step,String Error)
{    
    // 設定 ESP8266 作為 Client 端
    /**
    String cmd = "AT+CIPSTART=\"TCP\",\"";
    cmd += IP;
    cmd += "\",80";
    console("SEND: ");
    console(cmd);
    debug.println(cmd);
    if( debug.find( "Error" ) )
    {
        console( "RECEIVED: Error\nExit1" );
        return;
    }
    cmd = GET + "&field1=" + Vib + "&field2=" + Ang+ "&field3=" + Alarm +"&field4="+ Isactive +"&field5="+ Step + "&field6=" + Error +"\r\n\r\n";
    debug.print( "AT+CIPSEND=" );
    debug.println(cmd.length());
    if(debug.find( ">" ) )
    {
        console(">");
        console(cmd);
        debug.print(cmd);
    }
    else
    {
        debug.print( "AT+CIPCLOSE" );
    }
    if( debug.find("OK") )
    {
        console( "RECEIVED: OK" );
    }
    else
    {
        console( "RECEIVED: Error\nExit2" );
        //resend the data
        if(times<_max_recursion){
          times++;
          SentOnCloud(String(analogRead(_vibratepin)),String(angle),String(alarm),String(isactive),String(0),String(error & isintr));
        }else{
          connerror=1;
          times=0;
        }
    }**/
    String cmd = "AT+CIPSTART=\"TCP\",\"";
    cmd += "icane.herokuapp.com";
    cmd += "\",80";
    console("SEND: ");
    console(cmd);
    debug.println(cmd);
    if( debug.find( "Error" ) )
    {
        console( "RECEIVED: Error\nExit1" );
        return;
    }
    cmd = "GET /data?dev_name="+ DEV_NAME + "&vib=" + Vib + "&ang=" + Ang+ "&alarm=" + Alarm +"&isactive="+ Isactive +"&step="+ Step + "&error=" + Error +" HTTP/1.0\r\nHost: icane.herokuapp.com\r\n\r\n";
    debug.print( "AT+CIPSEND=" );
    debug.println(cmd.length());
    if(debug.find( ">" ) )
    {
        console(">");
        console(cmd);
        debug.print(cmd);
    }
    else
    {
        debug.print( "AT+CIPCLOSE" );
    }
    if( debug.find("OK") )
    {
        console( "RECEIVED: OK" );
    }
    else
    {
        console( "RECEIVED: Error\nExit2" );
        //resend the data
        if(times<_max_recursion){
          times++;
          SentOnCloud(String(analogRead(_vibratepin)),String(angle),String(alarm),String(isactive),String(0),String(error & isintr));
        }else{
          connerror=1;
          times=0;
        }
    }
}
void Wifi_connect()
{
    String cmd="AT+CWJAP=\"";
    cmd+=SSID;
    cmd+="\",\"";
    cmd+=PASS;
    cmd+="\"";
    sendDebug(cmd);
    Loding("Wifi_connect");
}

boolean Connect_to_NTU(){
    
    String cmd="AT+CWJAP=\"";
    
    
    cmd+="NTU";
    cmd+="\",\"\"";
    console(cmd);
    debug.println(cmd);
    Loding("Wifi_connect");

    if(NTUtcpconn()==true)return true;
    else return false;     
   
}

boolean NTUtcpconn(){
   String server="wl122.cc.ntu.edu.tw";
   String URI="/auth/loginnw.html";
   String port="80";
   String data="username=B05202030&password=Ceiba0084";
   // initiate TCP connection
    String tcpStart = "AT+CIPSTART=\"TCP\",\"" + server + "\"," + port;
    
    // prepare the data to be posted
    String postRequest =
        "POST " + URI + " HTTP/1.1\r\n" +
        "Host: " + server + ":" + port + "\r\n" +
        "Accept: *" + "/" + "*\r\n" +
        "Content-Length: " + String(data.length()) + "\r\n" +
        "Content-Type: application/x-www-form-urlencoded\r\n" +
        "\r\n" +
        data;

    // notify ESP8266 about the lenght of TCP packet
    String sendCmd = "AT+CIPSEND=" + String(postRequest.length());

    debug.println(tcpStart);
    console(tcpStart);
    if (debug.find("OK")) {
        console("NTU_TCP connection OK");
        if(sendingCmd(sendCmd,postRequest)==true){connerror=0;return true;}
        else {
          console("Cannot initiate TCP connection when conn to NTU");
          times++;
          if(times<_max_recursion)NTUtcpconn();
          else {times=0; connerror=1; return false;}
        }        
    }
    else {
        console("Cannot initiate TCP connection when conn to NTU");
        times++;
        if(times<_max_recursion)NTUtcpconn();
        else {times=0; connerror=1; return false;}
    }
}
int _2times=0;
int _3times=0;
boolean sendingCmd(String sendCmd,String postRequest){
  debug.println(sendCmd);
  console(sendCmd);
        while(!debug.find(">") && (_3times<(_max_recursion))){_3times++; debug.println(postRequest+"\r\n");console("Wait");}                        
   
        if(_3times<(_max_recursion)) {
            _3times=0;
            if(post(postRequest)==true){connerror=0;return true;}
            else {
               console("ESP8266 is not listening for incoming data when conn to NTU");
                _2times++;
                if(_2times<_max_recursion)sendingCmd(sendCmd,postRequest); 
                else {_2times=0; connerror=1; return false;}
            }
        }
        else {
            _3times=0;
            console("ESP8266 is not listening for incoming data when conn to NTU");
            connerror=1; return false;
        }
}

boolean post(String postRequest){
  console("Sending packet...");
            debug.println(postRequest+"\r\n");
            while(!debug.find("SEND OK") && (times<(_max_recursion))){times++; debug.println(postRequest+"\r\n");console("Wait");}
  
            if(times<(_max_recursion)) {
                console("Packet sent");
                while (debug.available()) {
                    String tmpResp = debug.readString();
                    console(tmpResp);
                }
                // close the connection
                debug.println("AT+CIPCLOSE");
                connerror=0;
                SentOnCloud(String(0),String(0),String(0),String(isactive),String(0),String(error)); //test
                return true;
            }
            else {
                console("An error occured while sending packet when conn to NTU");
                times=0; connerror=1; return false;
            }
            /**
            connerror=0;
            debug.println("AT+CIPCLOSE");
            SentOnCloud(String(0),String(0),String(0),String(isactive),String(0),String(error));
            return true;**/
}

void Loding(String state){
    for (int timeout=0 ; timeout<10 ; timeout++)
    {
      if(debug.find("OK"))
      {
          console("RECEIVED: OK");
          break;
      }
      else if(timeout==9){
        console( state );
        console(" fail...\nExit2");
      }
      else
      {
        console("Wifi Loading...");
        delay(500);
      }
    }
}
void sendDebug(String cmd)
{
    console("SEND: ");
    console(cmd);
    debug.print(cmd+"\r\n\r\n");
}
void changetouch(){
  if( (millis()-lasttouchtime) > _touchtimegate){
    Serial.println("I'm in changetouch");    
    lasttouchtime=millis();
    isintr=1;  
    tracetouch(); 
  } 
}
void changeangle(){
   
  if((millis()-lastangletime)>=_angle_fluct_time){
    
    lastangletime=millis();
    
    if(digitalRead(_anglepin)==HIGH){angle=1;}
    else angle=0;

    isintr=1;
    /**Alarm();
    SentOnCloud(String(analogRead(_vibratepin)),String(angle),String(alarm),String(isactive),String(0),String(error));**/
    console("I'm in changeangle:"+String(angle));
  } 
}

void tracetouch(){
  Serial.println("I'm in tracetouch");   
  if( (digitalRead(_touchpin)==_touched) || (millis()-lasttouchtime) <= _touchgate ){
    isactive=1;
  }else{
    isactive=0;
  }
  Serial.println("(touch)");
  Serial.println((digitalRead(_touchpin)));
  console("(isactive)");
  console(isactive);
  console("(angle)");
  console(angle);  
}

void countstep(){
  console("I'm in countstep");
  volatile bool lock=0;
  unsigned long start = millis();
  unsigned long debugcount =0;
  do{    
    int vibrate;
    vibrate=analogRead(_vibratepin);
    //console("I'm locked" +String(vibrate));
    if(vibrate>=_stepHIGH){lock=1;}
    else if( (lock==1) && ( vibrate<=_stepLOW || (debugcount >= (pow(2,30))))){stepcount++;lock=0;}
    if( (millis() - start) >= _steptime ) {lock=0;}
    debugcount++;
  }while(lock!=0);
  console("------------Step:"+String(stepcount/5));
    
  if((millis()-laststepcounttime)>=_step_flushing_time){
    SentOnCloud(String(analogRead(_vibratepin)),String(angle),String(alarm),String(isactive),String(stepcount/5),String(error & isintr));
    stepcount=0;
   }
}

void senseVibrate(){
  //console("I'm in senceVibrate");  
  int vib=analogRead(_vibratepin);  
  if(vib>maxvibrate){maxvibrate=vib;lastvibcounttime=millis();}
  if( (millis()-lastvibcounttime) > _flipvibsensetime )maxvibrate=0;
}

void betterycall(){
  console("I'm in betterycall");
  if((millis()-lastbatterytime)>=_battery_call_period){
    SentOnCloud(String(analogRead(_vibratepin)),String(angle),String(alarm),String(isactive),String(0),String(error & isintr));
    lastbatterytime=millis();
  }
}

void beepon(){
  detachInterrupt(0);
  detachInterrupt(1);
  digitalWrite(_beeppin,HIGH);
  delay(2000);
  digitalWrite(_beeppin,LOW);
  delay(2000);
  attachInterrupt(0,changetouch,CHANGE); //pin2
  attachInterrupt(1,changeangle,CHANGE); //pin3  
}
void beepoff(){
  //digitalWrite(_beeppin,LOW);
  //delay(500);
}
void alarmbeep(){
  console("I'm in alarmbeep!"+String(alarm));
  if(alarm==1){    
    beepon();
  }
}

void Alarm(){
  //delay(1000);
  console("I'm in Alarm");
  console("(Alarm)" + String(alarm));  
  if( (maxvibrate>_noflipvibgate) && (isactive==1) ){
    alarm=1;
    //attachInterrupt(0,changetouch,CHANGE); //pin2
    maxvibrate=0;
  }else if((angle!=_standingangle) && (isactive==1) )
  {
    unsigned long init=millis();
    unsigned long debugcount =0;
    maxvibrate=0;
    while( (maxvibrate<_vibrategate) && ((millis()-init)<_flipvibsensetime) && (debugcount < pow (2,50))){senseVibrate();debugcount++;}
    if(maxvibrate>_vibrategate){
      alarm=1;
      //attachInterrupt(0,changetouch,CHANGE); //pin2
      maxvibrate=0;
    }
  }
  //if(alarm==1){
  console("(MaxVib)" + String(maxvibrate));
  console("(Angle)" + String(angle)); 
  console("(Alarm)" + String(alarm));
  //} 
}
volatile unsigned long pwm_value=0; 
volatile unsigned long prev_time=0;
void alarmreset(){
   console("I'm in reset");
   console(String(alarm));
  if(alarm==1){      
      detachInterrupt(0);
      detachInterrupt(1);
      console("debounce on!");
      delay(500);
      console("debounce off!");
      pwm_value = 0;      
      attachInterrupt(0, rising, RISING);
      delay(10); //wait for measurement
      detachInterrupt(0);
      console("the pwm time is"+String(pwm_value));      
      if( ( pwm_value >= (1000*0.5) ) && ( pwm_value <= (1000*2) ) ){
          
          console("delay on!");
          delay(_alarm_reset_button_time);
          console("delay off!");
          pwm_value = 0;
          attachInterrupt(0, rising, RISING);
          delay(10); //wait for measurement
          detachInterrupt(0);          
          if( ( pwm_value >= (1000*0.5) ) && ( pwm_value <= (1000*2) ) ){
              alarm=0;
              console("!!!!RESET!!!!");
              console("the pwm time is"+String(pwm_value));
          }
      }
      delay(300);
      attachInterrupt(0,changetouch,CHANGE); //pin2
      attachInterrupt(1,changeangle,CHANGE); //pin3**/
  }
}

void rising() {  
  prev_time = micros();
 attachInterrupt(0, falling, FALLING);
}
 
void falling() {
  attachInterrupt(0, rising, RISING);
  pwm_value = micros()-prev_time;
  console("PWM_half_period: ");
  console(pwm_value);
  //detachInterrupt(0);
  //detachInterrupt(1);
}

void errorhandler(){
  console("I'm in errorhandler");  
  if(connerror==1){
    connectWiFi();
    connerror=0;
    SentOnCloud(String(analogRead(_vibratepin)),String(angle),String(alarm),String(isactive),String(0),String(error & isintr));
  }
  if(error==1){
   SentOnCloud(String(analogRead(_vibratepin)),String(angle),String(alarm),String(isactive),String(0),String(1));
   error=0;
  }
}

void console(String text){
  if(serial==true)Serial.println(text);
  if(is_sd==true){
    /**myFile = SD.open("card.txt", FILE_WRITE);       // 開啟檔案，一次僅能開啟一個檔案 
    if (myFile) {
          Serial.print("(SD COPIED):");
          Serial.println(text);               
          myFile.print(text);  // 繼續寫在檔案後面
          myFile.close();                               // 關閉檔案        
    }**/  
  }  
}

void console(int text){
  if(serial==true)Serial.println(text);
  if(is_sd==true){
    /**myFile = SD.open("card.txt", FILE_WRITE);       // 開啟檔案，一次僅能開啟一個檔案 
    if (myFile) {
          Serial.print("(SD COPIED):");
          Serial.println(text);                
          myFile.println(text);  // 繼續寫在檔案後面
          myFile.close();                               // 關閉檔案        
    }  **/
  }  
}
