let ToneAnalyzerV3 = require('watson-developer-cloud/tone-analyzer/v3');
let bodyParser = require('body-parser');
require('dotenv').config({silent: true});


exports.createToneRequest = function  (request) {
  let toneChatRequest;

  if (request.texts) {
    toneChatRequest = {utterances: []};

    for (let i in request.texts) {
      let utterance = {text: request.texts[i]};
      toneChatRequest.utterances.push(utterance);
    }
  }

  return toneChatRequest;
}


 exports.happyOrUnhappy = function  (response) {
  const happyTones = ['satisfied', 'excited', 'polite', 'sympathetic'];
  const unhappyTones = ['sad', 'frustrated', 'impolite'];

  let happyValue = 0;
  let unhappyValue = 0;

  for (let i in response.utterances_tone) {
    let utteranceTones = response.utterances_tone[i].tones;
    for (let j in utteranceTones) {
      if (happyTones.includes(utteranceTones[j].tone_id)) {
        happyValue = happyValue + utteranceTones[j].score;
      }
      if (unhappyTones.includes(utteranceTones[j].tone_id)) {
        unhappyValue = unhappyValue + utteranceTones[j].score;
      }
    }
  }
  if (happyValue >= unhappyValue) {
    return 'happy';
  }
  else {
    return 'unhappy';
  }
}




