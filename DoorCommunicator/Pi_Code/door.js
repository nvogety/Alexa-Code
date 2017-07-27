var watson = require('watson-developer-cloud');
var fs = require('fs');
var awsIot = require('aws-iot-device-sdk');
const exec = require('child_process').exec;
require('./processExecSync.js')

//AWS IOT Setup
var device = awsIot.device({
   keyPath: '<your-key>',
  certPath: '<your-cert>',
    caPath: '<your-rootCA>',
  clientId: '<your-id>',
      host: '<your-host>'
});

//IBM Speech to Text setup
var speech_to_text = watson.speech_to_text({
    username: '<your-user>',
    password: '<your-pass>',
    version: 'v1',
    url: 'https://stream.watsonplatform.net/speech-to-text/api'
});


//IBM Text to Speech setup
var text_to_speech = watson.text_to_speech({
  username: '<your-user>',
  password: '<your-pass>',
  version: 'v1', 
  url: 'https://stream.watsonplatform.net/text-to-speech/api'

});

//On connection
device
  .on('connect', function() {
    console.log('CONNECTED!');
    device.subscribe('alexaToPi');

});

//On recieved 
device
  .on('message', function(topic, payload) {
      var data = JSON.parse(payload);
      var msgID = data.messageID;
      var msg = data.message;

      var params = {
        text: msg,
        voice: 'en-US_AllisonVoice', // Optional voice
        accept: 'audio/wav'
      };

    // Pipe the synthesized text to a file
    text_to_speech.synthesize(params).pipe(fs.createWriteStream('alexaInput.wav'));
    setTimeout(
	function(){
	   var file = 'piOutput.wav';

           playSound('alexaInput.wav');

	   console.log('Starting Recording.......');
	   recordSound(file);

	   console.log("Send to Watson");
  	   var params = {
    		audio: fs.createReadStream(file),
    		content_type: 'audio/wav',
    		word_alternatives_threshold: 0.9
  	   };
  
  	   speech_to_text.recognize(params, function(error, transcript) {
    		if (error)
      		    console.log('Error:', error);
    		else {
		    var msgToAlexa = transcript.results[0].alternatives[0].transcript;
		    console.log("YOUR MESSAGE: "+ msgToAlexa);
		    device.publish('piToAlexa', JSON.stringify({ messageID:msgID, message:msgToAlexa}));
		    console.log("PUBLISHED TO IOT AND DB");
		}
  	   });
	}, 1500);
  });


function recordSound(fileName){
   console.log(String(processExecSync('arecord '+fileName+' -D sysdefault:CARD=1 -d 5 --format=S16_LE --rate=44100')));
}


function playSound(fileName){

   console.log(String(processExecSync('aplay /home/pi/Desktop/bluemix_aws/'+fileName)));
}

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




