// Import dependencies
const dotenv = require("dotenv");
dotenv.config();
const fs = require("fs");
const { google } = require("googleapis");
const service = google.forms("v1");
const credentials = require("./credentials.json");
const dz = require("deezer-js");
const deemix = require('deemix');

var arl;
var deezer_client = new dz.Deezer();
var addedAnswers = [];
if(!fs.existsSync("answers.json")){
    fs.writeFileSync("answers.json", JSON.stringify(addedAnswers), function (err, file) {
        if (err) throw err;
        console.log("Created answers.json!");
    });
}
else {
    addedAnswers = JSON.parse(fs.readFileSync("answers.json"));
}

// Configure auth client
const authClient = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key.replace(/\\n/g, "\n"),
    ["https://www.googleapis.com/auth/forms.responses.readonly"]
);


async function deezer_login(email, password) {
  accessToken = await deemix.utils.deezer.getAccessToken(email, password);
  if (!accessToken) throw new Error('Deezer login error');
  var arl = await deemix.utils.deezer.getArlFromAccessToken(accessToken);
  if (!arl) throw new Error('Deezer arl fetch error');
  return arl
}

async function getAnswers() {
  try {
    // Authorize the client
    const token = await authClient.authorize();

    // Set the client credentials
    authClient.setCredentials(token);

    // Get the rows
    const res = await service.forms.responses.list({
        auth: authClient,
        formId: process.env.FORM_ID,
    });
    return res.data.responses;
  }
  catch (error) {
    console.log(error);
  }
}

async function addToDeezer(titles) {
  if(!arl || !deezer_client.login_via_arl(arl)) {
    arl = await deezer_login(process.env.DEEZER_EMAIL, process.env.DEEZER_PASS);
    if(!deezer_client.login_via_arl(arl)) {
      throw new Error('Deezer login failed.');
    };
  }
  
  for(var i = 0; i < titles.length; i++) {
      var search = await deezer_client.api.search_track(titles[i], {limit: 1});
      if(search.total == 0) {
          console.log("Song not found: " + titles[i]);
          continue;
      }
      try {
        var trackId = search.data[0].id;
        var result = await deezer_client.gw.add_song_to_playlist(process.env.DEEZER_PLAYLIST, trackId);
        if(result.error) {
            console.log("Error adding song: " + titles[i]);
        }
        else {
            console.log("Added song: " + titles[i]);
        }
      }
      catch(err) {
          console.log(err);
      }
  }
}


setInterval(async function() {
  console.log("Checking for new answers...");  
  try {
    var answers = await getAnswers();
    if(!answers) {console.log("No answers"); return;}
    for(var i = 0; i < answers.length; i++) {
        if(!addedAnswers.includes(answers[i].responseId)) {
            addedAnswers.push(answers[i].responseId);
            console.log("Added answer: " + answers[i].responseId);
            var titles = [];
            for(answer in answers[i].answers) {
              var trackName = answers[i].answers[answer].textAnswers.answers[0].value;
              titles.push(trackName);
            }
            await addToDeezer(titles);
        }
    }
  }
  catch(err) {
    console.log(err);
  }
    
  fs.writeFileSync("answers.json", JSON.stringify(addedAnswers), function (err, file) {
      if (err) throw err;
  });
}, 2000);