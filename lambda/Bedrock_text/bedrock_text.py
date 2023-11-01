import json
import boto3

boto3_bedrock = boto3.client('bedrock-runtime')

def lambda_handler(event, context):
  
  
  content = (json.dumps(event))
  processed_content =json.loads(content, parse_float=str)
  claude_prompt = processed_content['queryStringParameters']['prompt']
 
  #claude_prompt = "Write a story about a cat eating pizza in space"
  prompt = "\n\nHuman: {prompts} \n\nAssistant:".format(prompts = claude_prompt)

  configs= {
    "prompt": prompt,
    "max_tokens_to_sample": 2048, 
    "temperature":0.5,
    "top_k":250,
    "top_p":1,
    "stop_sequences":["\n\nHuman:"]
  }
  body=json.dumps(configs)
  modelId = 'anthropic.claude-v2'
  response = boto3_bedrock.invoke_model(body=body, modelId=modelId, accept = 'application/json', contentType = 'application/json')
  response_body = json.loads(response.get('body').read())
  completion = response_body['completion']
  #print(completion)

    
  return {
        'statusCode': 200,
        'body': json.dumps(completion)
    }