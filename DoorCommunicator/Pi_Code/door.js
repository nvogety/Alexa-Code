//
// vDoorman code on the pi.
//    Connects with AWS and IBM Watson Cloud Services
//
//        AWS Services - AWS IoT SDK
//        IBM Watson - Text-to-Speech and Speech-To-Text APIs
//
//    Local Connections
//
//        Speaker to output speech from Alexa (over IoT)
//        Mic to record Visitor responses
//
//
var watson = require('watson-developer-cloud');
var awsIot = require('aws-iot-device-sdk');
var fs = require('fs');
const exec = require('child_process').exec;

require('./processExecSync.js')

//AWS IOT Setup, Credentials
var device = awsIot.device({
   keyPath: '[key-here]-private.pem.key',
  certPath: '[cert-here]-certificate.pem.crt',
    caPath: 'rootCA.pem',
  clientId: 'virtualDoorman',
      host: '[host-here].iot.us-east-1.amazonaws.com'
});

//IBM Speech to Text setup, Credentials
var speech_to_text = watson.speech_to_text({
	  username: '[speech-to-text-username]',
    password: '[speech-to-text-pw]',
    version: 'v1',
    url: 'https://stream.watsonplatform.net/speech-to-text/api'
});


//IBM Text to Speech setup, Credentials
var text_to_speech = watson.text_to_speech({
  username: '[text-to-speech-username]',
  password: '[text-tospeech-pw]',
  version: 'v1',
  url: 'https://stream.watsonplatform.net/text-to-speech/api'

});

// Connect to AWS IoT to send and receive Allexa messages

//On connection
device
  .on('connect', function() {
      // Subscribe to alexaToPi MQTT Topic
      device.subscribe('alexaToPi');
    });

//On recieveing a message
device
  .on('message', function(topic, payload) {

      var data = JSON.parse(payload);
      var msgID = data.messageID;
      var msg = data.message;

      // Prepare to use Watson's Text-to-Speech API
      var params = {
          text: msg,
          voice: 'en-US_AllisonVoice', // Optional voice
          accept: 'audio/wav'
      };

      // Pipe the synthesized text to a file
      text_to_speech.synthesize(params).pipe(fs.createWriteStream('alexaInput.wav'));

      setTimeout( function() {

	         var file = 'piOutput.wav';
           // alexaInput.wav has the systhesized voice from Watson
           playToVisitor('alexaInput.wav');

           // Record Visitor's Response
	         console.log('Waiting for Visitor to record.......');
	         recordVisitor(file);

           // Transcribe Visitor's Response to text using Watson's Speech-to-Text API
  	       var params = {
    		      audio: fs.createReadStream(file),
    		      content_type: 'audio/wav',
    		      word_alternatives_threshold: 0.9
  	       };

       	   speech_to_text.recognize(params, function(error, transcript) {
    	 	       if (error)
      		        console.log('Error:', error);
    		       else {
                  // Get the transcibed message from Watson
		              var msgToAlexa = transcript.results[0].alternatives[0].transcript;
                  // Send to Alexa via the IoT Service and piToAlexa MQTT topic
		              device.publish('piToAlexa', JSON.stringify({ messageID:msgID, message:msgToAlexa}));
		           }
  	       });  // Speech to text
	     }, 1500);  // setTimeout
  });  // On message from Alexa


// Record Visitor's response from Mic
function recordVisitor(fileName){
   console.log(String(processExecSync('arecord '+fileName+' -D sysdefault:CARD=1 -d 5 --format=S16_LE --rate=44100')));
}


// Play User/Alexa's message to the speakers
function playToVisitor(fileName){
   console.log(String(processExecSync('aplay /home/pi/Desktop/vDoorman/'+fileName)));
}

// Execute given function synchronously
function processExecSync(command, options) {
  /*
      this function emulates child_process.execSync for legacy node <= 0.10.x
      derived from https://github.com/gvarsanyi/sync-exec/blob/master/js/sync-exec.js
  */
  var child, error, fs, timeout, tmpdir;
  // init fs
  fs = require('fs');
  // init options
  options = options || {};
  // init timeout
  timeout = Date.now() + options.timeout;
  // init tmpdir
  tmpdir = '/tmp/processExecSync.' + Date.now() + Math.random();
  fs.mkdirSync(tmpdir);
  // init command
  command = '(' + command + ' > ' + tmpdir + '/stdout 2> ' + tmpdir +
      '/stderr); echo $? > ' + tmpdir + '/status';
  // init child
  child = require('child_process').exec(command, options, function () {
      return;
  });
  while (true) {
      try {
          fs.readFileSync(tmpdir + '/status');
          break;
      } catch (ignore) {
      }
      if (Date.now() > timeout) {
          error = child;
          break;
      }
  }
  ['stdout', 'stderr', 'status'].forEach(function (file) {
      child[file] = fs.readFileSync(tmpdir + '/' + file, options.encoding);
      fs.unlinkSync(tmpdir + '/' + file);
  });
  child.status = Number(child.status);
  if (child.status !== 0) {
      error = child;
  }
  try {
      fs.rmdirSync(tmpdir);
  } catch (ignore) {
  }
  if (error) {
      throw error;
  }
  return child.stdout;
}
