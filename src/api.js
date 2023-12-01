import axios from 'axios'
const { VOICEFLOW_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, PORT } =
  Bun.env

const VOICEFLOW_VERSION_ID = Bun.env.VOICEFLOW_VERSION_ID || 'development'
const VOICEFLOW_PROJECT_ID = Bun.env.VOICEFLOW_PROJECT_ID || null
let session = `${VOICEFLOW_VERSION_ID}.${createSession()}`
const client = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
let noreplyTimeout = null

export const Dialog = {
  interact: async function (from, to, body, set) {
    clearTimeout(noreplyTimeout)

    let requestData = {
      config: {
        tts: false,
        stripSSML: true,
        stopAll: true,
        excludeTypes: ['block', 'debug', 'flow'],
      },
    }

    if (!body) {
      console.log('No Reply')
      requestData.action = { type: 'no-reply' }
    } else {
      requestData.action = { type: 'text', payload: body.Body }
      if (body?.MediaContentType0?.includes('image')) {
        console.log('Add media URL')
        requestData.state = {
          variables: {
            imageUrl: body.MediaUrl0,
          },
        }
      }
    }
    return axios
      .post(
        `https://general-runtime.voiceflow.com/state/user/${encodeURI(
          from
        )}/interact?logs=off`,
        requestData,
        {
          headers: {
            Authorization: VOICEFLOW_API_KEY,
            accept: 'application / json',
            'content-type': 'application/json',
            versionID: VOICEFLOW_VERSION_ID,
            sessionid: session,
          },
        }
      )
      .then(function (response) {
        let noReply = 0
        // loop through the traces
        let messages = []
        for (const trace of response.data) {
          switch (trace.type) {
            case 'text':
            case 'speak': {
              messages.push({
                text: trace.payload.message.substring(0, 1600),
                delay: trace.payload.delay,
              }) // Max 1600 characters
              break
            }
            case 'visual': {
              messages.push({ image: trace.payload.image })
              break
            }
            case 'no-reply': {
              noReply = trace.payload.timeout
              break
            }
            case 'end': {
              saveTranscript(from)
              break
            }
            default: {
            }
          }
        }
        if (messages.length != 0) {
          sendMessages(to, from, messages, noReply)
        }
        return response.data
      })
      .catch(function (error) {
        console.log(error)
        set.status = 500
        return { error: 'Internal Server Error' }
      })
  },
}

const sendMessages = async (from, to, messages, noreply) => {
  let noReply = noreply * 1000
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]

    let delay
    const timeoutPerKB = 150 // adjust this value as needed

    const messageOptions = {
      from,
      to,
    }
    if (message.text) {
      messageOptions.body = message.text
      delay = message.delay || 2000 // Add a delay before sending each message
    } else if (message.image) {
      messageOptions.mediaUrl = message.image
      try {
        const response = await axios.head(message.image)
        if (response.headers['content-length']) {
          const imageSizeKB =
            parseInt(response.headers['content-length']) / 1024
          delay = Math.round(imageSizeKB * timeoutPerKB)
        }
      } catch (error) {
        console.error('Failed to fetch image size:', error)
        delay = 5000
      }
    }
    if (messageOptions) {
      client.messages.create(messageOptions).then((message) => {
        console.log(message.sid)
      })
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  if (noReply != 0) {
    noreplyTimeout = setTimeout(function () {
      Dialog.interact(to, from)
    }, noReply)
  }
}

function createSession() {
  // Random Number Generator
  var randomNo = Math.floor(Math.random() * 1000 + 1)
  // get Timestamp
  var timestamp = Date.now()
  // get Day
  var date = new Date()
  var weekday = new Array(7)
  weekday[0] = 'Sunday'
  weekday[1] = 'Monday'
  weekday[2] = 'Tuesday'
  weekday[3] = 'Wednesday'
  weekday[4] = 'Thursday'
  weekday[5] = 'Friday'
  weekday[6] = 'Saturday'
  var day = weekday[date.getDay()]
  // Join random number+day+timestamp
  var session_id = randomNo + day + timestamp
  return session_id
}

async function saveTranscript(username) {
  if (VOICEFLOW_PROJECT_ID) {
    console.log('SAVE TRANSCRIPT')
    if (!username || username == '' || username == undefined) {
      username = 'Anonymous'
    }
    axios({
      method: 'put',
      url: 'https://api.voiceflow.com/v2/transcripts',
      data: {
        browser: 'SMS',
        device: 'Phone',
        os: 'Twilio',
        sessionID: session,
        unread: true,
        versionID: VOICEFLOW_VERSION_ID,
        projectID: VOICEFLOW_PROJECT_ID,
        user: {
          name: username,
          image:
            'https://s3.amazonaws.com/com.voiceflow.studio/share/twilio-logo-png-transparent/twilio-logo-png-transparent.png',
        },
      },
      headers: {
        Authorization: VOICEFLOW_API_KEY,
      },
    })
      .then(function (response) {
        console.log('Saved!')
        session = `${VOICEFLOW_VERSION_ID}.${createSession()}`
      })
      .catch((err) => console.log(err))
  }
}
