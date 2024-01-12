// The name of your Azure OpenAI Resource.
let resourceName;

// The deployment name you chose when you deployed the model.
const mapper = {
    'gpt-3.5-turbo': 'gpt-35-turbo',
    'gpt-3.5-turbo-0613': 'gpt-35-turbo-0613',
    'gpt-3.5-turbo-1106': 'gpt-35-turbo-1106',
    'gpt-3.5-turbo-16k': 'gpt-35-turbo-16k',
    'gpt-4': 'gpt-4',
    'gpt-4-1106-preview': 'gpt-4-1106-preview',
    'gpt-4-vision-preview': 'gpt-4-vision-preview',
    'gpt-4-32k': 'gpt-4-32k',
    'dall-e-3': "dall-e-3",
};

const apiVersion="2023-12-01-preview"

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return handleOPTIONS(request)
  }

  const url = new URL(request.url);
  if (url.pathname.startsWith("//")) {
    url.pathname = url.pathname.replace('/',"")
  }
  if (url.pathname === '/v1/chat/completions') {
    var path="chat/completions"
  } else if (url.pathname === '/v1/images/generations') {
    var path="images/generations"
  } else if (url.pathname === '/v1/completions') {
    var path="completions"
  } else if (url.pathname === '/v1/models') {
    return handleModels(request)
  } else {
    return new Response('404 Not Found', { status: 404 })
  }

  let body;
  if (request.method === 'POST') {
    body = await request.json();
  }

  const modelName = body?.model;  
  const deployName = mapper[modelName] || '' 

  if (deployName === '') {
    return new Response('Missing model mapper', {
        status: 403
    });
  }
  const authKey2 = request.headers.get('Authorization');
  if (!authKey2) {
    return new Response("Not allowed", {
      status: 403
    });
  }
  // 假设request.headers.get('Authorization')返回的值是"resourceName-authKey"
  const authKeyFull = request.headers.get('Authorization');
  const lastDashIndex = authKeyFull.lastIndexOf('-');
  let authKey;
  if (lastDashIndex !== -1) {
    // 从右往左分割一次
    resourceName = authKeyFull.substring(0, lastDashIndex); // 从开始到最后一个"-"的位置
    authKey = authKeyFull.substring(lastDashIndex + 1); // 从最后一个"-"后面的位置到字符串结束
    resourceName = resourceName.replace('Bearer ', '');
    
  } else {
    // console.log("fail");
    // 如果没有找到"-"，可能是格式错误
      return new Response('Authorization header is in an incorrect format or does not contain "-"', {
        status: 403
      });
  }
  const fetchAPI = `https://${resourceName}.openai.azure.com/openai/deployments/${deployName}/${path}?api-version=${apiVersion}`
  // console.log(fetchAPI);
  // console.log(resourceName); // 输出第一个值
  // console.log(authKey); // 输出第二个值
  const payload = {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      "api-key": authKey,
    },
    body: typeof body === 'object' ? JSON.stringify(body) : '{}',
  };

  let response = await fetch(fetchAPI, payload);
  response = new Response(response.body, response);
  response.headers.set("Access-Control-Allow-Origin", "*");

  if (body?.stream != true){
    return response
  } 

  let { readable, writable } = new TransformStream()
  stream(response.body, writable);
  return new Response(readable, response);

}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// support printer mode and add newline
async function stream(readable, writable) {
  const reader = readable.getReader();
  const writer = writable.getWriter();

  // const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
// let decodedValue = decoder.decode(value);
  const newline = "\n";
  const delimiter = "\n\n"
  const encodedNewline = encoder.encode(newline);

  let buffer = "";
  while (true) {
    let { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true }); // stream: true is important here,fix the bug of incomplete line
    let lines = buffer.split(delimiter);

    // Loop through all but the last line, which may be incomplete.
    for (let i = 0; i < lines.length - 1; i++) {
      await writer.write(encoder.encode(lines[i] + delimiter));
      await sleep(20);
    }

    buffer = lines[lines.length - 1];
  }

  if (buffer) {
    await writer.write(encoder.encode(buffer));
  }
  await writer.write(encodedNewline)
  await writer.close();
}

async function handleModels(request) {
  const data = {
    "object": "list",
    "data": []  
  };

  for (let key in mapper) {
    data.data.push({
      "id": key,
      "object": "model",
      "created": 1677610602,
      "owned_by": "openai",
      "permission": [{
        "id": "modelperm-M56FXnG1AsIr3SXq8BYPvXJA",
        "object": "model_permission",
        "created": 1679602088,
        "allow_create_engine": false,
        "allow_sampling": true,
        "allow_logprobs": true,
        "allow_search_indices": false,
        "allow_view": true,
        "allow_fine_tuning": false,
        "organization": "*",
        "group": null,
        "is_blocking": false
      }],
      "root": key,
      "parent": null
    });  
  }

  const json = JSON.stringify(data, null, 2);
  return new Response(json, {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleOPTIONS(request) {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': '*',
        'Access-Control-Allow-Headers': '*'
      }
    })
}

